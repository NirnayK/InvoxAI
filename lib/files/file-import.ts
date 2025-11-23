import { invoke } from "@tauri-apps/api/core";

import { isTauriRuntime } from "../database";

export interface ImportedFileResult {
  id: string;
  duplicate: boolean;
  name: string;
}

const parseImportResponse = (response: string) => {
  if (response.startsWith("OK:")) {
    return { duplicate: false, id: response.slice(3) };
  }
  if (response.startsWith("DUPLICATE:")) {
    return { duplicate: true, id: response.slice("DUPLICATE:".length) };
  }
  throw new Error(`Unexpected import response: ${response}`);
};

async function importSingleFile(file: File): Promise<ImportedFileResult> {
  const fileBuffer = await file.arrayBuffer();
  const byteArray = Array.from(new Uint8Array(fileBuffer));

  const response = await invoke<string>("import_data", {
    fileName: file.name,
    bytes: byteArray,
  });
  const details = parseImportResponse(response);
  return { id: details.id, duplicate: details.duplicate, name: file.name };
}

export async function importFiles(files: File[]): Promise<ImportedFileResult[]> {
  if (files.length === 0) {
    return [];
  }
  if (!isTauriRuntime()) {
    throw new Error("File ingestion requires the Tauri desktop runtime.");
  }

  const results: ImportedFileResult[] = [];

  for (const file of files) {
    const imported = await importSingleFile(file);
    results.push(imported);
  }

  return results;
}
