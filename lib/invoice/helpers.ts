import { INVOICE_JSON_SCHEMA, SYSTEM_INSTRUCTION } from "./constants";
import type {
  ExtractionPayload,
  InvoiceExtractionResult,
  InvoiceFileInput,
  NormalizedFile,
} from "./types";

export type {
  ExtractionPayload,
  InvoiceExtractionResult,
  InvoiceFileInput,
  NormalizedFile,
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

export function ensureApiKey(value?: string): string {
  const apiKey = value ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY env var is required");
  }
  return apiKey;
}

export function prepareFiles(files: InvoiceFileInput[]): NormalizedFile[] {
  if (typeof Blob === "undefined") {
    throw new Error("Invoice processing requires Blob/File support.");
  }
  const seen = new Map<string, number>();
  return files.map((input, index) => {
    if (!(input.file instanceof Blob)) {
      throw new Error("Invoice processing only supports Blob/File inputs.");
    }
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

function detectMime(file: Blob): string {
  if (file.type) {
    return file.type;
  }
  const name = inferName(file);
  if (name && name.includes(".")) {
    const extension = `.${name.split(".").pop()!.toLowerCase()}`;
    return MIME_BY_EXTENSION[extension as keyof typeof MIME_BY_EXTENSION] ?? "application/octet-stream";
  }
  return "application/octet-stream";
}

function inferName(file: Blob): string | undefined {
  if ("name" in file && typeof (file as { name?: unknown }).name === "string") {
    return (file as { name?: string }).name;
  }
  return undefined;
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
