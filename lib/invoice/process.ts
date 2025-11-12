import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import type { GenerateContentResponse } from "@google/genai";
import { GoogleGenAI } from "@google/genai";

import { USER_PROMPT } from "./constants";
import {
  ExtractionPayload,
  GENERATION_CONFIG,
  InvoiceFileInput,
  NormalizedFile,
  UploadedFileRef,
  createBatchLine,
  ensureApiKey,
  extractFirstText,
  parseBatchResults,
  prepareFiles,
  tryParseInvoiceText,
  waitForBatchCompletion
} from "./helpers";

export type { ExtractionPayload, InvoiceExtractionResult, InvoiceFileInput } from "./helpers";

interface GeminiGeneratedResult {
  file: string;
  result: ExtractionPayload;
}

const DEFAULT_MODEL = "gemini-2.5-flash";

class GeminiInvoiceClient {
  constructor(private readonly ai: GoogleGenAI, private readonly model: string) {}

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

export interface BatchProcessOptions {
  files: InvoiceFileInput[];
  model?: string;
  apiKey?: string;
  displayName?: string;
  pollIntervalMs?: number;
}

export interface BatchProcessResult {
  jobName: string;
  state: string;
  resultFile?: string;
  byKey: Record<string, ExtractionPayload | Record<string, unknown>>;
  rawResultText?: string;
}

export async function batchProcessInvoices({
  files,
  model = DEFAULT_MODEL,
  apiKey,
  displayName,
  pollIntervalMs = 5_000,
}: BatchProcessOptions): Promise<BatchProcessResult> {
  const normalized = prepareFiles(files);
  if (!normalized.length) {
    throw new Error("At least one file is required for batch processing");
  }

  const ai = new GoogleGenAI({ apiKey: ensureApiKey(apiKey) });
  const client = new GeminiInvoiceClient(ai, model);
  const jobDisplayName = displayName ?? `invoice-batch-${Date.now()}`;
  const uploads = await client.uploadAll(normalized);
  const jsonlLines = uploads.map(createBatchLine);

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "invoice-batch-"));
  const batchFile = path.join(tempDir, "invoice_requests.jsonl");
  await fs.writeFile(batchFile, jsonlLines.join("\n"), "utf8");

  try {
    const { name: srcFile } = await ai.files.upload({
      file: batchFile,
      config: {
        displayName: jobDisplayName,
        mimeType: "application/jsonl",
      },
    });

    const job = await ai.batches.create({
      model,
      src: { fileName: srcFile, format: "jsonl" },
      config: { displayName: jobDisplayName },
    });

    const finalJob = await waitForBatchCompletion(ai, job.name ?? "", pollIntervalMs);
    const state = finalJob.state ?? "JOB_STATE_UNSPECIFIED";

    const result: BatchProcessResult = {
      jobName: finalJob.name ?? "",
      state,
      resultFile: finalJob.dest?.fileName ?? undefined,
      byKey: {},
      rawResultText: undefined,
    };

    if (state === "JOB_STATE_SUCCEEDED" && finalJob.dest?.fileName) {
      const downloadPath = path.join(tempDir, "invoice_results.jsonl");
      await ai.files.download({ file: finalJob.dest.fileName, downloadPath });
      const rawText = await fs.readFile(downloadPath, "utf8");
      result.rawResultText = rawText;
      result.byKey = parseBatchResults(rawText);
    }

    return result;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

function parseResponse(response: GenerateContentResponse): ExtractionPayload {
  return tryParseInvoiceText(extractFirstText(response)) ?? { _raw: "" };
}
