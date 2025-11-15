import { invoke } from "@tauri-apps/api/core";

import { isTauriRuntime } from "./database";

export interface StorageStats {
  path: string;
  totalBytes: number;
  fileCount: number;
}

const ensureTauri = () => {
  if (!isTauriRuntime()) {
    throw new Error("Storage details are only available inside the desktop shell.");
  }
};

export async function getStorageStats() {
  ensureTauri();
  return invoke<StorageStats>("get_storage_stats");
}

export async function clearStoredFiles() {
  ensureTauri();
  return invoke<StorageStats>("clear_processed_files");
}
