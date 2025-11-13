"use client";

import type React from "react";
import { useRef, useState } from "react";
import type { PutBlobResult } from "@vercel/blob";
import { upload } from "@vercel/blob/client";
import { AlertCircle, CheckCircle2, File, Info, Loader2, Upload, X } from "lucide-react";

interface FileUploadProps {
  maxFiles?: number;
  maxFileSize?: number;
  onFilesChange?: (files: File[]) => void;
  accept?: string;
  access?: "public" | "private";
  handleUploadUrl?: string;
  onUploadedChange?: (uploads: PutBlobResult[]) => void;
}

type UploadStatus =
  | "pending"
  | "hashing"
  | "checking"
  | "duplicate"
  | "uploading"
  | "uploaded"
  | "error";

interface ExistingFileRecord {
  id: string;
  url: string;
  path: string;
  hash_sha256: string;
  size_bytes: number;
  mime_type: string;
  original_name: string | null;
  created_at?: string;
  owner?: string | null;
}

interface UploadEntry {
  id: string;
  file: File;
  status: UploadStatus;
  blob?: PutBlobResult;
  error?: string;
  hash?: string;
  duplicateOf?: ExistingFileRecord | null;
  progress?: number;
}

interface UploadProgressEvent {
  loaded: number;
  total?: number;
  percentage?: number;
}

const DUPLICATE_CHECK_ENDPOINT = "/api/files/check";

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const sha256Hex = async (file: File) => {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const checkForDuplicate = async (hash: string) => {
  const response = await fetch(DUPLICATE_CHECK_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ hash }),
  });

  if (!response.ok) {
    throw new Error("Duplicate check failed");
  }

  return (await response.json()) as { exists: boolean; file?: ExistingFileRecord };
};

const buildPathname = (file: File, id: string) => {
  const extension = file.name.includes(".")
    ? `.${file.name.split(".").pop()?.toLowerCase()}`
    : "";
  return `uploads/${id}${extension}`;
};

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
    case "hashing":
    case "checking":
      return "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200";
    case "duplicate":
      return "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200";
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
    case "hashing":
    case "checking":
      return <Loader2 className="h-4 w-4 animate-spin" />;
    case "duplicate":
      return <Info className="h-4 w-4" />;
    case "error":
      return <AlertCircle className="h-4 w-4" />;
    default:
      return <Upload className="h-4 w-4" />;
  }
};

export function FileUpload({
  maxFiles = 10,
  maxFileSize = 100 * 1024 * 1024,
  onFilesChange,
  accept = "*",
  access = "public",
  handleUploadUrl = "/api/files/upload",
  onUploadedChange,
}: FileUploadProps) {
  const [files, setFiles] = useState<UploadEntry[]>([]);
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
          ).toFixed(0)}MB`,
        );
        continue;
      }
      validFiles.push(file);
    }

    const totalFiles = files.length + validFiles.length;
    if (totalFiles > maxFiles) {
      setError(
        `Maximum ${maxFiles} files allowed. You're trying to add ${validFiles.length} file(s).`,
      );
      return [];
    }

    return validFiles;
  };

  const emitUploadedBlobs = (entries: UploadEntry[]) => {
    if (!onUploadedChange) return;
    const uploaded = entries.flatMap((entry) => (entry.blob ? [entry.blob] : []));
    onUploadedChange(uploaded);
  };

  const updateFileEntry = (
    id: string,
    changes: Partial<UploadEntry>,
    { notifyUploaded }: { notifyUploaded?: boolean } = {},
  ) => {
    setFiles((prev) => {
      const updated = prev.map((item) => (item.id === id ? { ...item, ...changes } : item));
      if (notifyUploaded) {
        emitUploadedBlobs(updated);
      }
      return updated;
    });
  };

  const processEntry = async (entry: UploadEntry) => {
    updateFileEntry(entry.id, {
      status: "hashing",
      error: undefined,
      duplicateOf: null,
      progress: undefined,
    });

    let hash: string | null = null;
    try {
      hash = await sha256Hex(entry.file);
    } catch (hashError) {
      const message = hashError instanceof Error ? hashError.message : "Failed to hash file";
      updateFileEntry(entry.id, { status: "error", error: message });
      setError(message);
      return;
    }

    if (!hash) return;

    updateFileEntry(entry.id, { hash, status: "checking" });

    try {
      const check = await checkForDuplicate(hash);
      if (check.exists) {
        updateFileEntry(entry.id, {
          status: "duplicate",
          duplicateOf: check.file ?? null,
          progress: undefined,
        });
        return;
      }
    } catch (checkError) {
      const message =
        checkError instanceof Error ? checkError.message : "Duplicate check failed";
      updateFileEntry(entry.id, { status: "error", error: message });
      setError(message);
      return;
    }

    updateFileEntry(entry.id, { status: "uploading", progress: 0 });

    try {
      const pathname = buildPathname(entry.file, entry.id);
      const uploadOptions: Parameters<typeof upload>[2] & {
        onUploadProgress?: (event: UploadProgressEvent) => void;
      } = {
        access,
        contentType: entry.file.type || "application/octet-stream",
        handleUploadUrl,
        clientPayload: JSON.stringify({
          id: entry.id,
          hash,
          originalName: entry.file.name,
        }),
        onUploadProgress: (event) => {
          const percentage =
            typeof event.percentage === "number"
              ? Math.round(event.percentage)
              : Math.round(
                  (event.loaded / (event.total ?? event.loaded || 1)) * 100,
                );
          updateFileEntry(entry.id, { progress: Math.min(100, Math.max(0, percentage)) });
        },
      };

      const blobResult = await upload(pathname, entry.file, uploadOptions);

      updateFileEntry(
        entry.id,
        {
          status: "uploaded",
          blob: blobResult,
          progress: 100,
        },
        { notifyUploaded: true },
      );
    } catch (uploadError) {
      let message = uploadError instanceof Error ? uploadError.message : "Upload failed";

      if (uploadError instanceof Error && uploadError.message.toLowerCase().includes("duplicate")) {
        try {
          const check = await checkForDuplicate(hash);
          if (check.exists) {
            updateFileEntry(entry.id, {
              status: "duplicate",
              duplicateOf: check.file ?? null,
              progress: undefined,
            });
            return;
          }
        } catch {
          message = "Duplicate detected but could not fetch record";
        }
      }

      updateFileEntry(entry.id, { status: "error", error: message, progress: undefined });
      setError(message);
    }
  };

  const processEntries = (entries: UploadEntry[]) => {
    for (const entry of entries) {
      void processEntry(entry);
    }
  };

  const handleAddFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;

    const validFiles = validateFiles(Array.from(newFiles));
    if (validFiles.length === 0) return;

    const newEntries = validFiles.map<UploadEntry>((file) => ({
      id: createId(),
      file,
      status: "pending",
      duplicateOf: null,
    }));

    const updatedFiles = [...files, ...newEntries];
    setFiles(updatedFiles);
    onFilesChange?.(updatedFiles.map((item) => item.file));
    processEntries(newEntries);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => {
      const target = prev[index];
      if (!target) return prev;

      const updated = prev.filter((_, i) => i !== index);

      onFilesChange?.(updated.map((item) => item.file));
      emitUploadedBlobs(updated);
      setError("");
      return updated;
    });
  };

  const handleRetryUpload = (entry: UploadEntry) => {
    updateFileEntry(entry.id, {
      status: "pending",
      blob: undefined,
      error: undefined,
      duplicateOf: null,
      progress: undefined,
    });
    void processEntry(entry);
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
                emitUploadedBlobs([]);
                setError("");
              }}
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
                    {entry.blob?.url && (
                      <a
                        href={entry.blob.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                      >
                        View uploaded file
                      </a>
                    )}
                    {entry.status === "duplicate" && entry.duplicateOf && (
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        Duplicate of{" "}
                        <a
                          href={entry.duplicateOf.url}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          {entry.duplicateOf.original_name ?? entry.duplicateOf.path}
                        </a>
                      </p>
                    )}
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
                  {(entry.status === "hashing" || entry.status === "checking") && (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {entry.status === "hashing" ? "Computing hash" : "Checking duplicates"}
                    </span>
                  )}
                  {entry.status === "error" && (
                    <button
                      type="button"
                      onClick={() => handleRetryUpload(entry)}
                      className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Retry upload
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleRemoveFile(index)}
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
      )}
    </div>
  );
}
