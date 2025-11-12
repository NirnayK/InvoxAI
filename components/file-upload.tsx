"use client";

import type React from "react";
import { useRef, useState } from "react";
import { AlertCircle, File, Upload, X } from "lucide-react";

interface FileUploadProps {
  maxFiles?: number;
  maxFileSize?: number;
  onFilesChange?: (files: File[]) => void;
  accept?: string;
}

export function FileUpload({
  maxFiles = 10,
  maxFileSize = 100 * 1024 * 1024,
  onFilesChange,
  accept = "*",
}: FileUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFiles = (newFiles: File[]): File[] => {
    setError("");
    const validFiles: File[] = [];

    for (const file of newFiles) {
      if (file.size > maxFileSize) {
        setError(
          `File "${file.name}" exceeds maximum size of ${(
            maxFileSize /
            1024 /
            1024
          ).toFixed(0)}MB`
        );
        continue;
      }
      validFiles.push(file);
    }

    const totalFiles = files.length + validFiles.length;
    if (totalFiles > maxFiles) {
      setError(
        `Maximum ${maxFiles} files allowed. You're trying to add ${validFiles.length} file(s).`
      );
      return [];
    }

    return validFiles;
  };

  const handleAddFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;

    const validFiles = validateFiles(Array.from(newFiles));
    if (validFiles.length === 0) return;

    const updatedFiles = [...files, ...validFiles];
    setFiles(updatedFiles);
    onFilesChange?.(updatedFiles);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleRemoveFile = (index: number) => {
    const updatedFiles = files.filter((_, i) => i !== index);
    setFiles(updatedFiles);
    onFilesChange?.(updatedFiles);
    setError("");
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    handleAddFiles(event.dataTransfer.files);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleAddFiles(event.target.files);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
  };

  const getFileIcon = () => <File className="h-4 w-4" />;

  return (
    <div className="space-y-6">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-300 ${
          isDragging
            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
            : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900/50 hover:border-blue-400"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          onChange={handleInputChange}
          className="hidden"
          aria-label="Upload files"
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center space-y-4 text-center"
        >
          <span className="rounded-full bg-blue-100 p-4 dark:bg-blue-900/30">
            <Upload className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </span>
          <div className="space-y-2">
            <p className="text-lg font-semibold text-slate-900 dark:text-white">
              {isDragging ? "Drop your files here" : "Drag and drop your files here"}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              or click to browse from your computer
            </p>
          </div>
          <p className="pt-2 text-xs text-slate-500 dark:text-slate-500">
            Max {maxFiles} files • Max {(maxFileSize / 1024 / 1024).toFixed(0)}MB per file
          </p>
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/20">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 dark:text-white">
              Selected Files ({files.length})
            </h3>
            <button
              type="button"
              onClick={() => {
                setFiles([]);
                onFilesChange?.([]);
                setError("");
              }}
              className="text-sm text-slate-600 transition-colors hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
            >
              Clear all
            </button>
          </div>

          <div className="space-y-2">
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 text-left transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900/50"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="text-slate-400 dark:text-slate-500">{getFileIcon()}</span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900 dark:text-white">
                      {file.name}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveFile(index)}
                  className="ml-4 flex-shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950/20 dark:hover:text-red-400"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
