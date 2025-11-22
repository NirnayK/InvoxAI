import { readFileBinary } from "./filesystem";

import { MIME_BY_EXTENSION } from "@/lib/invoice/constants";
import type {
  ExtractionPayload,
  InvoiceExtractionResult,
  InvoiceFileInput,
} from "@/lib/invoice/helpers";

import { isTauriRuntime } from "./database";
import { getGeminiApiKey } from "./preferences";
import { appendSheetRows, createSheetForFiles, type SheetRowPayload } from "./sheets";
import { updateFileStatus, updateFileParsedDetails, type FileRecord } from "./files";
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

export interface FileProcessingResult {
  processedFiles: number;
  failedFiles: number;
  sheetId: number;
}

export interface FileProcessingOptions {
  onStatusUpdate?: (message: string) => void;
  onProgress?: (processed: number, total: number) => void;
}

const fileProcessingLogger = createLogger("FileProcessing");

/**
 * Process a selection of files and create a sheet with the results
 */
export async function processFiles(
  files: FileRecord[],
  sheetName: string,
  options?: FileProcessingOptions,
): Promise<FileProcessingResult> {
  if (!isTauriRuntime()) {
    throw new Error("Processing files requires the Invox desktop runtime.");
  }

  const emit = options?.onStatusUpdate;
  fileProcessingLogger.debug("Starting file processing", {
    data: { fileCount: files.length, sheetName },
  });

  if (!files.length) {
    throw new Error("No files provided for processing.");
  }

  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    fileProcessingLogger.error("Gemini API key missing");
    throw new Error("Set your Gemini API key in Account preferences before processing files.");
  }

  emit?.("Creating sheet...");
  const sheetId = await createSheetForFiles(
    files.map((f) => f.id),
    sheetName,
  );
  fileProcessingLogger.debug("Created sheet", { data: { sheetId, sheetName } });

  emit?.("Reading files from disk...");

  // Update all files to "Processing" status
  await Promise.all(files.map((file) => updateFileStatus(file.id, "Processing")));

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

    // Import batch processing function
    const { processBatchWithRetry } = await import("@/lib/invoice/process");

    // Process files in batches with retry logic
    const { results, errors } = await processBatchWithRetry({
      files: invoiceInputs,
      fileIds: fileIdsList,
      apiKey,
      onProgress: (processed, total) => {
        const remaining = total - processed;
        emit?.(`Processing files: ${processed} processed, ${remaining} remaining`);
        options?.onProgress?.(processed, total);
      },
    });

    fileProcessingLogger.debug("Batch processing completed", {
      data: {
        sheetId,
        successCount: results.length,
        errorCount: errors.length,
      },
    });

    // Update database for successful files
    emit?.("Saving extracted data...");
    const rows: SheetRowPayload[] = [];

    for (const result of results) {
      const payload = result.result;

      // Update file status and parsed details in database
      await updateFileStatus(result.fileId, "Processed");
      await updateFileParsedDetails(result.fileId, JSON.stringify(payload));

      if (isStructuredPayload(payload)) {
        rows.push({
          fileId: result.fileId,
          fileName: result.fileName,
          sellerName: payload["seller name"] ?? null,
          invoiceNumber: payload["invoce number"] ?? null,
          invoiceDate: payload.date ?? null,
          sellerAddress: payload["seller address"] ?? null,
          itemsJson: serializeItems(payload),
          rawPayload: JSON.stringify(payload),
        });
      } else {
        rows.push({
          fileId: result.fileId,
          fileName: result.fileName,
          sellerName: null,
          invoiceNumber: null,
          invoiceDate: null,
          sellerAddress: null,
          itemsJson: null,
          rawPayload: JSON.stringify(payload),
        });
      }
    }

    // Update database for failed files
    for (const error of errors) {
      await updateFileStatus(error.fileId, "Failed");
      await updateFileParsedDetails(
        error.fileId,
        JSON.stringify({ error: error.error, statusCode: error.statusCode }),
      );

      fileProcessingLogger.warn("File processing failed", {
        data: {
          sheetId,
          fileId: error.fileId,
          fileName: error.fileName,
          error: error.error,
        },
      });
    }

    await appendSheetRows(sheetId, rows);

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
      sheetId,
    };
  } catch (error) {
    // Mark all files as failed if processing crashes
    await Promise.all(files.map((file) => updateFileStatus(file.id, "Failed")));
    fileProcessingLogger.error("File processing failed", {
      data: { sheetId },
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
