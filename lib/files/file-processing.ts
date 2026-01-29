import { readFileBinary } from "../filesystem";

import { MIME_BY_EXTENSION } from "@/lib/invoice/constants";
import type { InvoiceFileInput } from "@/lib/invoice/helpers";

import { FILE_STATUS } from "../constants";
import { isTauriRuntime } from "../database";
import { FileCommands, type FileRecord } from "./";
import { createLogger } from "../logger";
import { getGeminiApiKey } from "../preferences";
import {
  getGeminiDefaultModel,
  getGeminiModelFallbackOrder,
} from "@/lib/invoice/model-catalog";
import { processInvoices } from "@/lib/invoice/process";

const FALLBACK_MIME = "application/octet-stream";
const PER_FILE_TIMEOUT_MS = 2 * 60 * 1000;

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

export interface FileProcessingResult {
  processedFiles: number;
  failedFiles: number;
}

export interface FileProcessingOptions {
  onStatusUpdate?: (message: string) => void;
  onProgress?: (processed: number, total: number) => void;
}

const fileProcessingLogger = createLogger("FileProcessing");

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Request timed out after 2 minutes")), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

/**
 * Process a selection of files and create a sheet with the results
 */
export async function processFiles(
  files: FileRecord[],
  options?: FileProcessingOptions,
): Promise<FileProcessingResult> {
  if (!isTauriRuntime()) {
    throw new Error("Processing files requires the Invox desktop runtime.");
  }

  const emit = options?.onStatusUpdate;
  fileProcessingLogger.debug("Starting file processing", {
    data: { fileCount: files.length },
  });

  if (!files.length) {
    throw new Error("No files provided for processing.");
  }

  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    fileProcessingLogger.error("Gemini API key missing");
    throw new Error("Set your Gemini API key in Account preferences before processing files.");
  }

  emit?.("Reading files from disk...");

  // Update all files to "Processing" status
  await Promise.all(files.map((file) => FileCommands.updateStatus(file.id, FILE_STATUS.PROCESSING)));

  try {
    const labelToFile = new Map<string, FileRecord>();
    const invoiceInputs: InvoiceFileInput[] = [];
    const fileIdsList: string[] = [];

    for (const [index, file] of files.entries()) {
      const data = await readFileBinary(file.storedPath);
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
      fileIdsList.push(file.id);
    }

    emit?.(`Processing ${invoiceInputs.length} files...`);

    const fallbackOrder = await getGeminiModelFallbackOrder();
    const defaultModel = await getGeminiDefaultModel();
    const modelsToTry = fallbackOrder.length > 0 ? fallbackOrder : [defaultModel];

    const results: import("@/lib/invoice/types").BatchExtractionResult[] = [];
    const errors: import("@/lib/invoice/types").ProcessingError[] = [];

    for (let index = 0; index < invoiceInputs.length; index += 1) {
      const file = invoiceInputs[index];
      const fileId = fileIdsList[index];
      const fileName = file.displayName ?? `file-${index + 1}`;
      let lastError: Error | null = null;
      let processed = false;

      for (const model of modelsToTry) {
        try {
          const result = await withTimeout(
            processInvoices({ files: [file], model, apiKey }),
            PER_FILE_TIMEOUT_MS,
          );
          if (result.length > 0) {
            results.push({
              fileId,
              fileName,
              result: result[0].result,
            });
            processed = true;
            break;
          }
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          const is429 =
            error instanceof Error &&
            (error.message.includes("429") ||
              error.message.toLowerCase().includes("rate limit") ||
              error.message.toLowerCase().includes("quota"));
          if (!is429) {
            break;
          }
        }
      }

      if (!processed) {
        errors.push({
          fileId,
          fileName,
          error: lastError?.message ?? "Unknown error",
          statusCode: lastError?.message.includes("429") ? 429 : undefined,
        });
      }

      const processedCount = results.length + errors.length;
      const remaining = invoiceInputs.length - processedCount;
      emit?.(`Processing files: ${processedCount} processed, ${remaining} remaining`);
      options?.onProgress?.(processedCount, invoiceInputs.length);
    }

    fileProcessingLogger.debug("Batch processing completed", {
      data: {
        successCount: results.length,
        errorCount: errors.length,
      },
    });

    // Update database for successful files
    emit?.("Saving extracted data...");

    for (const result of results) {
      const payload = result.result;

      // Update file status and parsed details in database
      await FileCommands.updateStatus(result.fileId, FILE_STATUS.PROCESSED);
      await FileCommands.updateParsedDetails(result.fileId, JSON.stringify(payload));
    }

    // Update database for failed files
    for (const error of errors) {
      await FileCommands.updateStatus(error.fileId, FILE_STATUS.FAILED);
      await FileCommands.updateParsedDetails(
        error.fileId,
        JSON.stringify({ error: error.error, statusCode: error.statusCode }),
      );

      fileProcessingLogger.warn("File processing failed", {
        data: {
          fileId: error.fileId,
          fileName: error.fileName,
          error: error.error,
        },
      });
    }

    // Provide feedback based on results
    if (errors.length === 0) {
      emit?.("Processing completed successfully.");
    } else if (results.length === 0) {
      emit?.("Processing failed: all files failed to process.");
    } else {
      emit?.(`Processing completed with ${errors.length} failed file(s).`);
    }

    return {
      processedFiles: results.length,
      failedFiles: errors.length,
    };
  } catch (error) {
    // Mark all files as failed if processing crashes
    await Promise.all(files.map((file) => FileCommands.updateStatus(file.id, FILE_STATUS.FAILED)));
    fileProcessingLogger.error("File processing failed", {
      error,
    });
    throw error;
  }
}
