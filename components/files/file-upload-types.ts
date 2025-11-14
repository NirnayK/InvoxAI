export type UploadStatus = "pending" | "uploading" | "uploaded" | "error";

export interface UploadEntry {
  id: string;
  file: File;
  status: UploadStatus;
  error?: string;
  progress?: number;
}
