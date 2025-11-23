import type { FileStatus } from "../constants";
import type { FileListQuery, FileRecord, PaginatedFilesResult } from "./types";

/**
 * File Repository Interface
 * Defines the contract for file data access operations
 * Implements Repository Pattern with CQRS separation
 */
export interface FileRepository {
  // Queries (read-only)
  listFiles(query: FileListQuery): Promise<PaginatedFilesResult>;
  getById(id: string): Promise<FileRecord | null>;

  // Commands (write)
  updateStatus(fileId: string, status: FileStatus): Promise<void>;
  updateParsedDetails(fileId: string, data: string): Promise<void>;
  deleteFiles(fileIds: string[]): Promise<void>;
}
