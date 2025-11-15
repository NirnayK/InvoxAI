import { readFileBinary } from "./filesystem";

import { MIME_BY_EXTENSION } from "@/lib/invoice/constants";
import type {
  ExtractionPayload,
  InvoiceExtractionResult,
  InvoiceFileInput,
} from "@/lib/invoice/helpers";
import { processInvoices } from "@/lib/invoice/process";

import { isTauriRuntime } from "./database";
import { getGeminiApiKey } from "./preferences";
import { appendSheetRows, type SheetRowPayload } from "./sheets";
import {
  getSheetByTaskId,
  getStoredFilesByIds,
  getTaskDetail,
  type StoredTaskFile,
  updateTaskStatus,
} from "./tasks";
import { createLogger } from "./logger";

const FALLBACK_MIME = "application/octet-stream";

const inferMimeType = (name?: string | null, fallback?: string | null) => {
  if (fallback) {
    return fallback;
  }
  if (!name) {
    return FALLBACK_MIME;
  }
  const extension = name.includes(".") ? `.${name.split(".").pop()!.toLowerCase()}` : "";
  return MIME_BY_EXTENSION[extension as keyof typeof MIME_BY_EXTENSION] ?? FALLBACK_MIME;
};

const ensureUint8Array = (value: Uint8Array | number[]) => {
  return value instanceof Uint8Array ? value : Uint8Array.from(value);
};

const createFileLabel = (fileName: string, id: string) => {
  const shortId = id.slice(0, 8);
  return `${fileName} (#${shortId})`;
};

export interface TaskProcessingResult {
  processedFiles: number;
}

export interface TaskProcessingOptions {
  onStatusUpdate?: (message: string) => void;
}

const taskProcessingLogger = createLogger("TaskProcessing");

export async function processTaskById(
  taskId: number,
  options?: TaskProcessingOptions,
): Promise<TaskProcessingResult> {
  if (!isTauriRuntime()) {
    throw new Error("Processing tasks requires the Invox desktop runtime.");
  }

  const emit = options?.onStatusUpdate;
  taskProcessingLogger.debug("Starting task processing", {
    data: { taskId },
  });
  emit?.("Loading task details...");

  const task = await getTaskDetail(taskId);
  if (!task) {
    taskProcessingLogger.error("Task missing in local database", { data: { taskId } });
    throw new Error("Task not found in the local database.");
  }
  taskProcessingLogger.debug("Loaded task details", {
    data: {
      taskId: task.id,
      name: task.name,
      fileIds: task.fileIds,
    },
  });
  if (!task.fileIds.length) {
    taskProcessingLogger.warn("Task has no attached files", { data: { taskId: task.id } });
    throw new Error("This task has no files to process. Attach files before running it.");
  }

  const storedFiles = await getStoredFilesByIds(task.fileIds);
  taskProcessingLogger.debug("Queried stored files", {
    data: {
      requestedFileIds: task.fileIds,
      retrievedCount: storedFiles.length,
    },
  });
  if (!storedFiles.length) {
    taskProcessingLogger.error("No stored files found for task", {
      data: { taskId: task.id, fileIds: task.fileIds },
    });
    throw new Error("Unable to locate the files associated with this task.");
  }
  const storedMap = new Map(storedFiles.map((file) => [file.id, file] as const));
  const orderedFiles = task.fileIds
    .map((id) => storedMap.get(id))
    .filter((value): value is StoredTaskFile => Boolean(value));

  if (orderedFiles.length !== task.fileIds.length) {
    taskProcessingLogger.error("Some files referenced by task are missing", {
      data: {
        taskId: task.id,
        requested: task.fileIds,
        retrieved: orderedFiles.map((file) => file?.id ?? "unknown"),
      },
    });
    throw new Error("Some files referenced by this task are missing from local storage.");
  }

  const sheetExists = await getSheetByTaskId(taskId);
  if (!sheetExists) {
    taskProcessingLogger.error("No sheet linked to task", { data: { taskId: task.id } });
    throw new Error("This task is not linked to a sheet. Assign a sheet before processing.");
  }

  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    taskProcessingLogger.error("Gemini API key missing", { data: { taskId: task.id } });
    throw new Error("Set your Gemini API key in Account preferences before processing tasks.");
  }

  emit?.("Reading files from disk...");
  await updateTaskStatus(taskId, "Processing");

  try {
    const labelToFile = new Map<string, StoredTaskFile>();
    const invoiceInputs: InvoiceFileInput[] = [];

    for (const [index, file] of orderedFiles.entries()) {
      const data = await readFileBinary(file.path);
      const buffer = ensureUint8Array(data);
      let sourceBuffer: ArrayBuffer;
      let offset = buffer.byteOffset;
      if (buffer.buffer instanceof ArrayBuffer) {
        sourceBuffer = buffer.buffer;
      } else {
        const copy = Uint8Array.from(buffer);
        sourceBuffer = copy.buffer;
        offset = 0;
      }
      const arrayBuffer = sourceBuffer.slice(offset, offset + buffer.byteLength);
      const fileName = file.fileName ?? `file-${index + 1}`;
      const mimeType = inferMimeType(file.fileName, file.mimeType);
      const label = createFileLabel(fileName, file.id);
      const blob = new File([arrayBuffer], fileName, { type: mimeType });
      invoiceInputs.push({ file: blob, mimeType, displayName: label });
      labelToFile.set(label, file);
    }

    emit?.("Uploading files to Gemini...");
    const responses = await processInvoices({ files: invoiceInputs, apiKey });
    if (!responses.length) {
      throw new Error("Gemini returned an empty response for this task.");
    }

    emit?.("Saving extracted data...");
    const rows: SheetRowPayload[] = responses.map((response) => {
      const file = labelToFile.get(response.file);
      const payload = response.result;
      if (isStructuredPayload(payload)) {
        return {
          fileId: file?.id ?? null,
          fileName: file?.fileName ?? response.file,
          sellerName: payload["seller name"] ?? null,
          invoiceNumber: payload["invoce number"] ?? null,
          invoiceDate: payload.date ?? null,
          sellerAddress: payload["seller address"] ?? null,
          itemsJson: serializeItems(payload),
          rawPayload: JSON.stringify(payload),
        };
      }
      return {
        fileId: file?.id ?? null,
        fileName: file?.fileName ?? response.file,
        sellerName: null,
        invoiceNumber: null,
        invoiceDate: null,
        sellerAddress: null,
        itemsJson: null,
        rawPayload: JSON.stringify(payload),
      };
    });

    await appendSheetRows(taskId, rows);
    await updateTaskStatus(taskId, "Completed");
    emit?.("Task completed successfully.");
    return { processedFiles: rows.length };
  } catch (error) {
    await updateTaskStatus(taskId, "Failed");
    taskProcessingLogger.error("Task processing failed", {
      data: { taskId },
      error,
    });
    throw error;
  }
}

const isStructuredPayload = (payload: ExtractionPayload): payload is InvoiceExtractionResult => {
  return (
    payload != null &&
    typeof payload === "object" &&
    ("seller name" in payload ||
      "invoce number" in payload ||
      "seller address" in payload ||
      "date" in payload)
  );
};

const serializeItems = (payload: InvoiceExtractionResult) => {
  if (!Array.isArray(payload.items)) {
    return "[]";
  }
  try {
    return JSON.stringify(payload.items);
  } catch {
    return "[]";
  }
};
