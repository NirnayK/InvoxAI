import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../database";
import type { FileListQuery, FileRecord, PaginatedFilesResult } from "./types";

/**
 * File Queries - Read-only operations
 * Follows CQRS pattern by separating read operations from write operations
 */
export const FileQueries = {
  /**
   * List files with pagination, filtering, and sorting
   */
  async listFiles(query: FileListQuery): Promise<PaginatedFilesResult> {
    if (!isTauriRuntime()) {
      throw new Error("File listing requires the Tauri desktop runtime.");
    }

    return invoke<PaginatedFilesResult>("list_files_paginated", { query });
  },

  /**
   * Get a single file by ID
   */
  async getById(id: string): Promise<FileRecord | null> {
    if (!isTauriRuntime()) {
      throw new Error("File operations require the Tauri desktop runtime.");
    }

    const result = await this.listFiles({
      limit: 1,
      offset: 0,
    });

    return result.files.find((f: FileRecord) => f.id === id) ?? null;
  },
};
