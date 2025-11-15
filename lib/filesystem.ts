import { invoke } from "@tauri-apps/api/tauri";

import { isTauriRuntime } from "./database";

const ensureTauri = () => {
  if (!isTauriRuntime()) {
    throw new Error("Filesystem APIs require the Tauri desktop runtime.");
  }
};

export type DirectoryEntry = {
  name: string;
  path: string;
  isDir: boolean;
  isFile: boolean;
};

export async function listDirectory(path?: string) {
  ensureTauri();
  return invoke<DirectoryEntry[]>("list_directory", { path });
}

export async function readFile(path: string) {
  ensureTauri();
  return invoke<string>("read_file", { path });
}

export async function saveFile(path: string, contents: string, overwrite = true) {
  ensureTauri();
  return invoke<void>("save_file", { path, contents, overwrite });
}

export async function createDirectory(path: string, recursive = true) {
  ensureTauri();
  return invoke<void>("create_directory", { path, recursive });
}
