"use client";

import { useEffect } from "react";
import { File, X } from "lucide-react";

import type { UploadEntry } from "./file-upload-types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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

const getFileIcon = () => <File className="h-4 w-4" />;

const trimFileName = (name: string, maxLength = 22) => {
  if (name.length <= maxLength) {
    return name;
  }

  const extIndex = name.lastIndexOf(".");
  const extension = extIndex !== -1 ? name.slice(extIndex) : "";
  const base = extIndex !== -1 ? name.slice(0, extIndex) : name;
  const baseLimit = maxLength - extension.length - 3;

  if (baseLimit <= 0) {
    return `${name.slice(0, maxLength - 3)}...`;
  }

  return `${base.slice(0, baseLimit)}...${extension}`;
};

export function FileList({ files, onClearAll, onRemoveFile, onRetryUpload }: FileListProps) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") {
      return;
    }

    console.group("[FileList]");
    console.log("file count:", files.length);
    console.log("files detail:", files);
    console.groupEnd();
  }, [files]);

  if (files.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 dark:text-white">
          Selected Files ({files.length})
        </h3>
        <Button
          variant="link"
          size="sm"
          className="text-slate-500 dark:text-slate-300"
          onClick={onClearAll}
        >
          Clear all
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        {files.map((entry, index) => (
          <Card
            key={entry.id}
            className="flex flex-none w-full max-w-[250px] flex-col !gap-3 rounded-2xl border border-slate-200 bg-white px-4 !py-4 text-left shadow-sm transition-shadow hover:shadow-lg dark:border-slate-700/80 dark:bg-slate-900/50"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="text-slate-400 dark:text-slate-500">{getFileIcon()}</span>
                <div className="min-w-0">
                  <p
                    title={entry.file.name}
                    className="truncate text-sm font-semibold text-slate-900 dark:text-white"
                  >
                    {trimFileName(entry.file.name)}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {formatFileSize(entry.file.size)}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-500 hover:text-red-600 dark:text-slate-400"
                onClick={() => onRemoveFile(index)}
                aria-label={`Remove ${entry.file.name}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {entry.status === "error" && (
              <div className="flex items-center justify-between gap-2 text-xs text-red-600 dark:text-red-400">
                <p className="text-[11px] text-red-600 dark:text-red-400">
                  {entry.error ?? "Upload failed"}
                </p>
                <Button
                  variant="link"
                  size="sm"
                  className="px-0 text-[11px] text-blue-600 hover:text-blue-500 dark:text-blue-300"
                  onClick={() => onRetryUpload(entry)}
                >
                  Retry
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
