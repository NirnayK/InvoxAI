/**
 * Centralized constants for file status values
 *
 * These constants define the file processing states used throughout the application.
 * Note: The Rust backend (src-tauri/src/commands.rs and src-tauri/src/db.rs)
 * also uses these string values for database operations.
 */
export const FILE_STATUS = {
  UNPROCESSED: "Unprocessed",
  PROCESSING: "Processing",
  PROCESSED: "Processed",
  FAILED: "Failed",
} as const;

export type FileStatus = (typeof FILE_STATUS)[keyof typeof FILE_STATUS];
