import { invoke } from "@tauri-apps/api/core";

import { isTauriRuntime } from "./database";

export interface FileRecord {
  id: string;
  fileName: string;
  storedPath: string;
  sizeBytes: number;
  mimeType: string | null;
  status: "Unprocessed" | "Processing" | "Processed" | "Failed";
  parsedDetails: string | null;
  createdAt: string;
  processedAt: string | null;
  updatedAt: string | null;
}

export interface PaginatedFilesResult {
  files: FileRecord[];
  totalCount: number;
}

export interface FileListQuery {
  statusFilter?: string;
  searchQuery?: string;
  limit: number;
  offset: number;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
}

/**
 * List files with pagination, filtering, and sorting
 */
export async function listFilesPaginated(query: FileListQuery): Promise<PaginatedFilesResult> {
  if (!isTauriRuntime()) {
    throw new Error("File listing requires the Tauri desktop runtime.");
  }

  return invoke<PaginatedFilesResult>("list_files_paginated", { query });
}

/**
 * Get a single file by ID
 */
export async function getFileById(id: string): Promise<FileRecord | null> {
  if (!isTauriRuntime()) {
    throw new Error("File operations require the Tauri desktop runtime.");
  }

  const result = await listFilesPaginated({
    limit: 1,
    offset: 0,
  });

  return result.files.find((f) => f.id === id) ?? null;
}

/**
 * Update the status of a single file
 */
export async function updateFileStatus(fileId: string, status: string): Promise<void> {
  if (!isTauriRuntime()) {
    throw new Error("File operations require the Tauri desktop runtime.");
  }

  await invoke("update_file_status", { fileId, status });
}

/**
 * Update the status of multiple files at once
 */
export async function updateFilesStatus(fileIds: string[], status: string): Promise<void> {
  if (!isTauriRuntime()) {
    throw new Error("File operations require the Tauri desktop runtime.");
  }

  await invoke("update_files_status", { fileIds, status });
}

/**
 * Delete files by their IDs
 */
export async function deleteFiles(fileIds: string[]): Promise<void> {
  if (!isTauriRuntime()) {
    throw new Error("File operations require the Tauri desktop runtime.");
  }

  await invoke("delete_files", { fileIds });
}

/**
 * Update parsed details for a file
 */
export async function updateFileParsedDetails(
  fileId: string,
  parsedDetails: string,
): Promise<void> {
  if (!isTauriRuntime()) {
    throw new Error("File operations require the Tauri desktop runtime.");
  }

  const db = await import("./database").then((mod) => mod.getDatabase());
  await db.execute("UPDATE files SET parsed_details = ?1 WHERE id = ?2", [parsedDetails, fileId]);
}
