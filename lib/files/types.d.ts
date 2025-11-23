export type { FileStatus } from "../constants";

export interface FileRecord {
  id: string;
  fileName: string;
  storedPath: string;
  sizeBytes: number;
  mimeType: string | null;
  status: FileStatus;
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
