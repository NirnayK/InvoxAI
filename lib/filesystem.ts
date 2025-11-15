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

type TauriCoreModule = typeof import("@tauri-apps/api/core");

let tauriCorePromise: Promise<TauriCoreModule> | null = null;

const getTauriCore = async () => {
  if (!tauriCorePromise) {
    tauriCorePromise = import("@tauri-apps/api/core");
  }
  return tauriCorePromise;
};

const invokeWithRuntime = async <T>(command: string, payload?: Record<string, unknown>) => {
  ensureTauri();
  const { invoke } = await getTauriCore();
  return invoke<T>(command, payload);
};

export async function listDirectory(path?: string) {
  return invokeWithRuntime<DirectoryEntry[]>("list_directory", { path });
}

export async function readFile(path: string) {
  return invokeWithRuntime<string>("read_file", { path });
}

export async function readFileBinary(path: string) {
  const bytes = await invokeWithRuntime<number[]>("read_binary_file", { path });
  return Uint8Array.from(bytes);
}

export async function saveFile(path: string, contents: string, overwrite = true) {
  return invokeWithRuntime<void>("save_file", { path, contents, overwrite });
}

export async function createDirectory(path: string, recursive = true) {
  return invokeWithRuntime<void>("create_directory", { path, recursive });
}
