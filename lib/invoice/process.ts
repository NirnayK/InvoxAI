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

export type { ExtractionPayload, InvoiceExtractionResult, InvoiceFileInput } from "./helpers";

interface GeminiGeneratedResult {
  file: string;
  result: ExtractionPayload;
}

export const DEFAULT_MODEL = "gemini-2.5-flash";

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
