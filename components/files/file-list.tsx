"use client";

import { AlertCircle, CheckCircle2, File, Loader2, Upload, X } from "lucide-react";

import type { UploadEntry, UploadStatus } from "./file-upload-types";

interface FileListProps {
  files: UploadEntry[];
  onClearAll: () => void;
  onRemoveFile: (index: number) => void;
  onRetryUpload: (entry: UploadEntry) => void;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
};

const getStatusStyles = (status: UploadStatus) => {
  switch (status) {
    case "uploaded":
      return "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300";
    case "uploading":
      return "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200";
    case "error":
      return "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300";
    default:
      return "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300";
  }
};

const getStatusIcon = (status: UploadStatus) => {
  switch (status) {
    case "uploaded":
      return <CheckCircle2 className="h-4 w-4" />;
    case "uploading":
      return <Loader2 className="h-4 w-4 animate-spin" />;
    case "error":
      return <AlertCircle className="h-4 w-4" />;
    default:
      return <Upload className="h-4 w-4" />;
  }
};

const getFileIcon = () => <File className="h-4 w-4" />;

export function FileList({ files, onClearAll, onRemoveFile, onRetryUpload }: FileListProps) {
  if (files.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 dark:text-white">
          Selected Files ({files.length})
        </h3>
        <button
          type="button"
          onClick={onClearAll}
          className="text-sm text-slate-600 transition-colors hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
        >
          Clear all
        </button>
      </div>

      <div className="space-y-2">
        {files.map((entry, index) => (
          <div
            key={entry.id}
            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 text-left transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900/50"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="text-slate-400 dark:text-slate-500">{getFileIcon()}</span>
              <div className="min-w-0 space-y-1">
                <p className="truncate font-medium text-slate-900 dark:text-white">
                  {entry.file.name}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {formatFileSize(entry.file.size)}
                </p>
                {entry.status === "error" && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {entry.error ?? "Upload failed"}
                  </p>
                )}
              </div>
            </div>
            <div className="ml-4 flex flex-col items-end gap-2 text-right text-xs">
              <span
                className={`flex items-center gap-1 rounded-full px-2 py-1 ${getStatusStyles(entry.status)}`}
              >
                {getStatusIcon(entry.status)}
                <span className="capitalize">{entry.status}</span>
              </span>
              {entry.status === "uploading" && typeof entry.progress === "number" && (
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {entry.progress}%
                </span>
              )}
              {entry.status === "error" && (
                <button
                  type="button"
                  onClick={() => onRetryUpload(entry)}
                  className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  Retry upload
                </button>
              )}

              <button
                type="button"
                onClick={() => onRemoveFile(index)}
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950/20 dark:hover:text-red-400"
                aria-label={`Remove ${entry.file.name}`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
