import type { PutBlobResult } from "@vercel/blob";

export type UploadStatus = "pending" | "uploading" | "uploaded" | "error";

export interface UploadEntry {
  id: string;
  file: File;
  status: UploadStatus;
  blob?: PutBlobResult;
  error?: string;
  progress?: number;
}
