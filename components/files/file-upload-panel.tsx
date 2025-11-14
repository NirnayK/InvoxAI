"use client";

import { AlertCircle, File as FileIcon, Upload, X } from "lucide-react";
import type { ChangeEvent, DragEvent } from "react";
import { useRef, useState } from "react";

import { ALLOWED_EXTENSIONS } from "@/lib/invoice/constants";

interface FileUploadPanelProps {
  maxFiles?: number;
  maxFileSize?: number; // bytes
  onFilesChange?: (files: File[]) => void;
  accept?: string;
}

const DEFAULT_MAX_FILES = 10;
const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB to match reference

export function FileUploadPanel({
  maxFiles = DEFAULT_MAX_FILES,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  onFilesChange,
  accept = ALLOWED_EXTENSIONS.join(","),
}: FileUploadPanelProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const size = Math.round((bytes / Math.pow(k, i)) * 100) / 100;
    return `${size} ${sizes[i]}`;
  };

  const handleFiles = (incomingFiles: FileList | null) => {
    if (!incomingFiles) return;
    setError("");

    const newFiles = Array.from(incomingFiles);
    const validFiles: File[] = [];

    for (const file of newFiles) {
      if (file.size > maxFileSize) {
        setError(`File "${file.name}" exceeds ${Math.round(maxFileSize / 1024 / 1024)}MB limit.`);
        continue;
      }
      validFiles.push(file);
    }

    const total = files.length + validFiles.length;
    if (total > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed (you tried to add ${validFiles.length}).`);
      return;
    }

    if (validFiles.length) {
      const updated = [...files, ...validFiles];
      setFiles(updated);
      onFilesChange?.(updated);
    }

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleRemove = (index: number) => {
    const updated = files.filter((_, i) => i !== index);
    setFiles(updated);
    onFilesChange?.(updated);
    setError("");
  };

  const handleDrag = (event: DragEvent<HTMLDivElement>, dragging: boolean) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(dragging);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    handleFiles(event.dataTransfer.files);
  };

  const getFileIcon = () => <FileIcon className="h-4 w-4" />;

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 rounded-[32px] bg-slate-50/80 p-8 shadow-[0_25px_80px_rgba(15,23,42,0.08)]">
      <div className="space-y-1">
        <h2 className="text-3xl font-semibold text-slate-900">File Upload</h2>
        <p className="text-sm text-slate-500">Drag and drop your files or click to browse</p>
      </div>

      <div
        onDragOver={(event) => handleDrag(event, true)}
        onDragLeave={(event) => handleDrag(event, false)}
        onDrop={handleDrop}
        className={`rounded-[28px] border-2 border-dashed p-10 text-center transition ${
          isDragging ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          onChange={(event: ChangeEvent<HTMLInputElement>) => handleFiles(event.target.files)}
          className="sr-only"
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-3 text-center"
        >
          <span className="rounded-full bg-blue-100 p-4">
            <Upload className="h-7 w-7 text-blue-600" />
          </span>
          <p className="text-base font-semibold text-slate-900">
            {isDragging ? "Drop your files here" : "Drag and drop your files here"}
          </p>
          <p className="text-sm text-slate-500">or click to browse from your computer</p>
          <p className="text-xs text-slate-400">
            Max {maxFiles} files • Max {(maxFileSize / 1024 / 1024).toFixed(0)}MB per file
          </p>
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm font-semibold text-slate-600">
          <span>Selected Files ({files.length})</span>
          {files.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                setFiles([]);
                onFilesChange?.([]);
                setError("");
              }}
              className="text-blue-500 hover:underline"
            >
              Clear all
            </button>
          ) : (
            <span className="text-slate-400">Clear all</span>
          )}
        </div>

        {files.length > 0 ? (
          <div className="space-y-2">
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="text-blue-500">{getFileIcon()}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{file.name}</p>
                    <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="rounded-full p-2 text-slate-400 hover:text-red-500"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-400">
            Your files will appear here once selected.
          </p>
        )}
      </div>
    </section>
  );
}
