import type { FileRecord } from "@/lib/files";

/**
 * Custom hook to compute derived file selection state
 */
export function useFileSelection(selectedFiles: FileRecord[]) {
  const unprocessedFiles = selectedFiles.filter((f) => f.status === "Unprocessed");
  const processedFiles = selectedFiles.filter((f) => f.status === "Processed");
  const hasSelection = selectedFiles.length > 0;

  return { unprocessedFiles, processedFiles, hasSelection };
}
