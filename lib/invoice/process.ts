import type { GenerateContentResponse } from "@google/genai";
import { GoogleGenAI } from "@google/genai";

import { USER_PROMPT } from "./constants";
import { getGeminiDefaultModel, getGeminiModelRateLimits } from "./model-catalog";
import { claimGeminiModelRequest } from "./model-usage";
import {
  ExtractionPayload,
  GENERATION_CONFIG,
  InvoiceFileInput,
  NormalizedFile,
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

export class GeminiInvoiceClient {
  constructor(
    private readonly ai: GoogleGenAI,
    private readonly model: string,
  ) {}

  async generate(file: NormalizedFile): Promise<GeminiGeneratedResult> {
    const rateLimits = await getGeminiModelRateLimits();
    await claimGeminiModelRequest(this.model, rateLimits[this.model]);

    const inlineData = await toInlineData(file);

    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: [
        {
          role: "user",
          parts: [
            { text: USER_PROMPT },
            { inlineData: { data: inlineData.data, mimeType: inlineData.mimeType } },
          ],
        },
      ],
      config: GENERATION_CONFIG,
    });

    return { file: file.label, result: parseResponse(response) };
  }
}

const toInlineData = async (
  file: NormalizedFile,
): Promise<{ mimeType: string; data: string }> => {
  if (typeof Blob !== "undefined" && file.source instanceof Blob) {
    const buffer = await file.source.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    if (typeof Buffer !== "undefined") {
      return { mimeType: file.mimeType, data: Buffer.from(bytes).toString("base64") };
    }

    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return { mimeType: file.mimeType, data: btoa(binary) };
  }

  throw new Error("Inline Gemini processing only supports Blob/File inputs.");
};

export interface ProcessInvoicesOptions {
  files: InvoiceFileInput[];
  model?: string;
  apiKey?: string;
}

export async function processInvoices({
  files,
  model,
  apiKey,
}: ProcessInvoicesOptions): Promise<GeminiGeneratedResult[]> {
  if (!files.length) {
    return [];
  }

  const normalized = prepareFiles(files);
  const resolvedModel = model ?? (await getGeminiDefaultModel());
  const client = new GeminiInvoiceClient(
    new GoogleGenAI({ apiKey: ensureApiKey(apiKey) }),
    resolvedModel,
  );
  return Promise.all(normalized.map((file) => client.generate(file)));
}

function parseResponse(response: GenerateContentResponse): ExtractionPayload {
  return tryParseInvoiceText(extractFirstText(response)) ?? { _raw: "" };
}
