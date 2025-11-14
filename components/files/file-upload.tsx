"use client";

import { AlertCircle, Upload } from "lucide-react";

import { FileList } from "./file-list";
import type { FileUploadProps } from "./use-file-upload";
import { useFileUpload } from "./use-file-upload";

export function FileUpload(props: FileUploadProps) {
  const {
    accept,
    maxFiles,
    maxFileSize,
    files,
    error,
    inputRef,
    openFileDialog,
    handleClearFiles,
    handleRemoveFile,
    handleRetryUpload,
    handleInputChange,
  } = useFileUpload(props);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-300 bg-white p-8 text-center shadow-sm dark:border-slate-600 dark:bg-slate-900/50">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          onChange={handleInputChange}
          className="hidden"
          aria-label="Upload files"
        />
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-3">
            <button
              type="button"
              onClick={openFileDialog}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
            >
              <Upload className="h-4 w-4" />
              Add Files
            </button>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Max {maxFiles} files • {(maxFileSize / 1024 / 1024).toFixed(0)}MB each
            </p>
          </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/20">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      <FileList
        files={files}
        onClearAll={handleClearFiles}
        onRemoveFile={handleRemoveFile}
        onRetryUpload={handleRetryUpload}
      />
    </div>
  );
}
