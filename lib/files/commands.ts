import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../database";
import type { FileStatus } from "../constants";

/**
 * File Commands - Write operations
 * Follows CQRS pattern by separating write operations from read operations
 */
export const FileCommands = {
  /**
   * Update the status of a single file
   */
  async updateStatus(fileId: string, status: FileStatus): Promise<void> {
    if (!isTauriRuntime()) {
      throw new Error("File operations require the Tauri desktop runtime.");
    }

    await invoke("update_file_status", { fileId, status });
  },

  /**
   * Update the status of multiple files at once
   */
  async updateMultipleStatus(fileIds: string[], status: FileStatus): Promise<void> {
    if (!isTauriRuntime()) {
      throw new Error("File operations require the Tauri desktop runtime.");
    }

    await invoke("update_files_status", { fileIds, status });
  },

  /**
   * Update parsed details for a file
   */
  async updateParsedDetails(fileId: string, parsedDetails: string): Promise<void> {
    if (!isTauriRuntime()) {
      throw new Error("File operations require the Tauri desktop runtime.");
    }

    await invoke("update_file_parsed_details", { fileId, parsedDetails });
  },

  /**
   * Delete files by their IDs
   */
  async deleteFiles(fileIds: string[]): Promise<void> {
    if (!isTauriRuntime()) {
      throw new Error("File operations require the Tauri desktop runtime.");
    }

    await invoke("delete_files", { fileIds });
  },

  /**
   * Open files on the host operating system
   */
  async openFiles(paths: string[]): Promise<void> {
    if (!isTauriRuntime()) {
      throw new Error("File operations require the Tauri desktop runtime.");
    }

    await invoke("open_file_paths", { paths });
  },

  /**
   * Copy a stored file to a destination path selected by the user
   */
  async copyFileToPath(sourcePath: string, targetPath: string, overwrite = false): Promise<void> {
    if (!isTauriRuntime()) {
      throw new Error("File operations require the Tauri desktop runtime.");
    }

    await invoke("copy_file_to_path", { sourcePath, targetPath, overwrite });
  },
};
