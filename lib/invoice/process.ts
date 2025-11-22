import type { GenerateContentResponse } from "@google/genai";
import { GoogleGenAI } from "@google/genai";

import { USER_PROMPT } from "./constants";
import {
  ExtractionPayload,
  GENERATION_CONFIG,
  InvoiceFileInput,
  NormalizedFile,
  UploadedFileRef,
  ensureApiKey,
  extractFirstText,
  prepareFiles,
  tryParseInvoiceText,
} from "./helpers";

export type {
  ExtractionPayload,
  InvoiceExtractionResult,
  InvoiceFileInput,
  BatchExtractionResult,
  ProcessingError,
} from "./helpers";

interface GeminiGeneratedResult {
  file: string;
  result: ExtractionPayload;
}

export const DEFAULT_MODEL = "gemini-2.5-flash";

export const MODEL_FALLBACK_ORDER = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
] as const;

export class GeminiInvoiceClient {
  constructor(
    private readonly ai: GoogleGenAI,
    private readonly model: string,
  ) {}

  async generate(file: NormalizedFile): Promise<GeminiGeneratedResult> {
    const uploaded = await this.upload(file);
    if (!uploaded.fileUri) {
      throw new Error(`Upload for ${file.label} missing file URI`);
    }

    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: [
        {
          role: "user",
          parts: [
            { text: USER_PROMPT },
            { fileData: { fileUri: uploaded.fileUri, mimeType: uploaded.mimeType } },
          ],
        },
      ],
      config: GENERATION_CONFIG,
    });

    return { file: file.label, result: parseResponse(response) };
  }

  uploadAll(files: NormalizedFile[]): Promise<UploadedFileRef[]> {
    return Promise.all(files.map((file) => this.upload(file)));
  }

  private async upload(file: NormalizedFile): Promise<UploadedFileRef> {
    const uploaded = await this.ai.files.upload({
      file: file.source,
      config: {
        mimeType: file.mimeType,
        displayName: file.displayName ?? file.label,
      },
    });
    if (!uploaded?.name) {
      throw new Error(`Upload failed for ${file.label}: missing file ID`);
    }
    return {
      label: file.label,
      fileName: uploaded.name,
      fileUri: uploaded.uri,
      mimeType: uploaded.mimeType ?? file.mimeType,
    };
  }
}

export interface ProcessInvoicesOptions {
  files: InvoiceFileInput[];
  model?: string;
  apiKey?: string;
}

export async function processInvoices({
  files,
  model = DEFAULT_MODEL,
  apiKey,
}: ProcessInvoicesOptions): Promise<GeminiGeneratedResult[]> {
  if (!files.length) {
    return [];
  }

  const normalized = prepareFiles(files);
  const client = new GeminiInvoiceClient(new GoogleGenAI({ apiKey: ensureApiKey(apiKey) }), model);
  return Promise.all(normalized.map((file) => client.generate(file)));
}

function parseResponse(response: GenerateContentResponse): ExtractionPayload {
  return tryParseInvoiceText(extractFirstText(response)) ?? { _raw: "" };
}

interface BatchProcessOptions {
  files: InvoiceFileInput[];
  fileIds: string[];
  apiKey: string;
  onProgress?: (processed: number, total: number) => void;
}

interface BatchResult {
  results: import("./types").BatchExtractionResult[];
  errors: import("./types").ProcessingError[];
}

// Model-specific rate limits (requests per minute)
const MODEL_RATE_LIMITS: Record<string, { rpm: number; concurrent: number }> = {
  "gemini-2.5-flash": { rpm: 10, concurrent: 5 },
  "gemini-2.5-flash-lite": { rpm: 15, concurrent: 5 },
  "gemini-2.0-flash": { rpm: 15, concurrent: 5 },
  "gemini-2.0-flash-lite": { rpm: 30, concurrent: 10 },
  "gemini-2.5-pro": { rpm: 2, concurrent: 1 }, // Very limited!
};

const BATCH_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes
const DEFAULT_CONCURRENT = 3; // Default if model not in rate limits

/**
 * Process files in batches with retry logic and model fallback
 */
export async function processBatchWithRetry({
  files,
  fileIds,
  apiKey,
  onProgress,
}: BatchProcessOptions): Promise<BatchResult> {
  const results: import("./types").BatchExtractionResult[] = [];
  const errors: import("./types").ProcessingError[] = [];
  let processedCount = 0;

  /**
   * Process a single file with retry logic across models
   */
  async function processSingleFile(
    file: InvoiceFileInput,
    fileId: string,
    index: number,
  ): Promise<void> {
    const fileName = file.displayName ?? `file-${index + 1}`;
    let lastError: Error | null = null;
    let processed = false;

    // Try each model in the fallback order
    for (const model of MODEL_FALLBACK_ORDER) {
      try {
        const result = await processWithTimeout(
          processInvoices({ files: [file], model, apiKey }),
          BATCH_TIMEOUT_MS,
        );

        if (result.length > 0) {
          results.push({
            fileId,
            fileName,
            result: result[0].result,
          });
          processed = true;
          break; // Success, move to next file
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if it's a 429 error
        const is429 =
          error instanceof Error &&
          (error.message.includes("429") ||
            error.message.toLowerCase().includes("rate limit") ||
            error.message.toLowerCase().includes("quota"));

        if (!is429) {
          // Non-429 error, don't retry with other models
          break;
        }
        // 429 error, try next model in fallback order
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

    // Update progress
    processedCount++;
    onProgress?.(processedCount, files.length);
  }

  /**
   * Process files in chunks with concurrency control
   */
  async function processChunk(
    chunkFiles: InvoiceFileInput[],
    chunkFileIds: string[],
    startIndex: number,
    concurrency: number,
  ): Promise<void> {
    // Process files in parallel with concurrency limit
    for (let i = 0; i < chunkFiles.length; i += concurrency) {
      const batch = chunkFiles.slice(i, Math.min(i + concurrency, chunkFiles.length));
      const batchIds = chunkFileIds.slice(i, Math.min(i + concurrency, chunkFileIds.length));

      // Process batch in parallel using Promise.allSettled
      await Promise.allSettled(
        batch.map((file, j) => processSingleFile(file, batchIds[j], startIndex + i + j)),
      );
    }
  }

  // Determine concurrency based on the default model
  const defaultModelLimits = MODEL_RATE_LIMITS[DEFAULT_MODEL];
  const concurrency = defaultModelLimits?.concurrent ?? DEFAULT_CONCURRENT;

  // Process all files with appropriate concurrency
  await processChunk(files, fileIds, 0, concurrency);

  return { results, errors };
}

/**
 * Process with timeout
 */
function processWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out after 2 minutes")), timeoutMs),
    ),
  ]);
}
