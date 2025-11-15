import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { GoogleGenAI } from "@google/genai";

import {
  type ExtractionPayload,
  createBatchLine,
  ensureApiKey,
  parseBatchResults,
  prepareFiles,
  waitForBatchCompletion,
} from "./helpers";
import { DEFAULT_MODEL, GeminiInvoiceClient } from "./process";

import type { InvoiceFileInput } from "./helpers";

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
