import { readFileBinary } from "../filesystem";

import { MIME_BY_EXTENSION } from "@/lib/invoice/constants";
import type { InvoiceFileInput } from "@/lib/invoice/helpers";

import { FILE_STATUS } from "../constants";
import { isTauriRuntime } from "../database";
import { FileCommands, type FileRecord } from "./";
import { createLogger } from "../logger";
import { getGeminiApiKey } from "../preferences";

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
