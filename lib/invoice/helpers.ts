import path from "node:path";

import type { GoogleGenAI } from "@google/genai";

import { INVOICE_JSON_SCHEMA, SYSTEM_INSTRUCTION, USER_PROMPT } from "./constants";
import type {
  ExtractionPayload,
  InvoiceExtractionResult,
  InvoiceFileInput,
  NormalizedFile,
  UploadedFileRef,
} from "./types";

export type {
  ExtractionPayload,
  InvoiceExtractionResult,
  InvoiceFileInput,
  NormalizedFile,
  UploadedFileRef,
  BatchExtractionResult,
  ProcessingError,
} from "./types";

const MIME_BY_EXTENSION: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".bmp": "image/bmp",
  ".heic": "image/heic",
};

export const GENERATION_CONFIG = {
  systemInstruction: SYSTEM_INSTRUCTION,
  responseMimeType: "application/json",
  responseJsonSchema: INVOICE_JSON_SCHEMA,
  temperature: 0,
};

const BATCH_GENERATION_CONFIG = {
  system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
  response_mime_type: "application/json",
  response_json_schema: INVOICE_JSON_SCHEMA,
  temperature: 0,
};

export function ensureApiKey(value?: string): string {
  const apiKey = value ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY env var is required");
  }
  return apiKey;
}

export function prepareFiles(files: InvoiceFileInput[]): NormalizedFile[] {
  const seen = new Map<string, number>();
  return files.map((input, index) => {
    const baseLabel = input.displayName ?? inferName(input.file) ?? `file-${index + 1}`;
    const count = seen.get(baseLabel) ?? 0;
    seen.set(baseLabel, count + 1);
    const label = count === 0 ? baseLabel : `${baseLabel}-${count + 1}`;
    return {
      source: input.file,
      mimeType: input.mimeType ?? detectMime(input.file),
      displayName: input.displayName ?? label,
      label,
    };
  });
}

export function createBatchLine(upload: UploadedFileRef): string {
  return JSON.stringify({
    key: upload.label,
    request: {
      contents: [
        {
          role: "user",
          parts: [{ text: USER_PROMPT }, { file_data: { file_name: upload.fileName } }],
        },
      ],
      config: BATCH_GENERATION_CONFIG,
    },
  });
}

export async function waitForBatchCompletion(
  ai: GoogleGenAI,
  jobName: string,
  pollIntervalMs: number,
) {
  if (!jobName) {
    throw new Error("Batch job response missing name");
  }
  let job = await ai.batches.get({ name: jobName });
  while (
    job.state &&
    ["JOB_STATE_QUEUED", "JOB_STATE_PENDING", "JOB_STATE_RUNNING"].includes(job.state)
  ) {
    await delay(pollIntervalMs);
    job = await ai.batches.get({ name: jobName });
  }
  return job;
}

export function parseBatchResults(
  rawText: string,
): Record<string, ExtractionPayload | Record<string, unknown>> {
  return rawText
    .split(/\r?\n/)
    .filter(Boolean)
    .reduce<Record<string, ExtractionPayload | Record<string, unknown>>>((acc, line, index) => {
      try {
        const obj = JSON.parse(line);
        const key =
          typeof obj.key === "string" && obj.key.length > 0 ? obj.key : `line-${index + 1}`;
        acc[key] = tryParseInvoiceText(extractFirstText(obj.response)) ?? obj;
      } catch (error) {
        acc[`line-${index + 1}`] = {
          _raw: line,
          error: error instanceof Error ? error.message : String(error),
        };
      }
      return acc;
    }, {});
}

function detectMime(file: string | Blob): string {
  if (typeof file === "string") {
    return MIME_BY_EXTENSION[path.extname(file).toLowerCase()] ?? "application/octet-stream";
  }
  return isBlob(file) && file.type ? file.type : "application/octet-stream";
}

function inferName(file: string | Blob): string | undefined {
  if (typeof file === "string") {
    return path.basename(file);
  }
  if (isBlob(file) && "name" in file && typeof (file as { name?: unknown }).name === "string") {
    return (file as { name?: string }).name;
  }
  return undefined;
}

function isBlob(value: unknown): value is Blob {
  return typeof Blob !== "undefined" && value instanceof Blob;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function tryParseInvoiceText(text?: string | null): ExtractionPayload | null {
  if (!text) {
    return null;
  }
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return JSON.parse(trimmed) as InvoiceExtractionResult;
  } catch {
    return { _raw: trimmed };
  }
}

type TextCarrier = {
  text?: string;
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

export function extractFirstText(source?: TextCarrier): string {
  if (!source) {
    return "";
  }
  if (source.text) {
    return source.text;
  }
  for (const candidate of source.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (part.text) {
        return part.text;
      }
    }
  }
  return "";
}
