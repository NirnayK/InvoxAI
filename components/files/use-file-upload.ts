"use client";

import type { PutBlobResult } from "@vercel/blob";
import { upload } from "@vercel/blob/client";
import type React from "react";
import { useCallback, useRef, useState } from "react";

import type { UploadEntry } from "./file-upload-types";

type ClientUploadOptions = Parameters<typeof upload>[2];

export interface FileUploadProps {
  maxFiles?: number;
  maxFileSize?: number;
  onFilesChange?: (files: File[]) => void;
  accept?: string;
  access?: ClientUploadOptions["access"];
  handleUploadUrl?: string;
  onUploadedChange?: (uploads: PutBlobResult[]) => void;
}

interface UploadProgressEvent {
  loaded: number;
  total?: number;
  percentage?: number;
}

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const buildPathname = (file: File, id: string) => {
  const extension = file.name.includes(".") ? `.${file.name.split(".").pop()?.toLowerCase()}` : "";
  return `uploads/${id}${extension}`;
};

export const useFileUpload = ({
  maxFiles = 10,
  maxFileSize = 100 * 1024 * 1024,
  onFilesChange,
  accept = "*",
  access = "public",
  handleUploadUrl = "/api/files/upload",
  onUploadedChange,
}: FileUploadProps = {}) => {
  const [files, setFiles] = useState<UploadEntry[]>([]);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const emitUploadedBlobs = useCallback(
    (entries: UploadEntry[]) => {
      if (!onUploadedChange) return;
      const uploaded = entries.flatMap((entry) => (entry.blob ? [entry.blob] : []));
      onUploadedChange(uploaded);
    },
    [onUploadedChange],
  );

  const updateFileEntry = useCallback(
    (
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
    },
    [emitUploadedBlobs],
  );

  const processEntry = useCallback(
    async (entry: UploadEntry) => {
      updateFileEntry(entry.id, {
        status: "uploading",
        error: undefined,
        progress: 0,
      });

      try {
        const pathname = buildPathname(entry.file, entry.id);
        const uploadOptions: Parameters<typeof upload>[2] & {
          onUploadProgress?: (event: UploadProgressEvent) => void;
        } = {
          access,
          contentType: entry.file.type || "application/octet-stream",
          handleUploadUrl,
          onUploadProgress: (event) => {
            const percentage =
              typeof event.percentage === "number"
                ? Math.round(event.percentage)
                : Math.round((event.loaded / ((event.total ?? event.loaded) || 1)) * 100);
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
        const message = uploadError instanceof Error ? uploadError.message : "Upload failed";

        updateFileEntry(entry.id, { status: "error", error: message, progress: undefined });
        setError(message);
      }
    },
    [access, handleUploadUrl, updateFileEntry],
  );

  const processEntries = useCallback(
    (entries: UploadEntry[]) => {
      for (const entry of entries) {
        void processEntry(entry);
      }
    },
    [processEntry],
  );

  const validateFiles = useCallback(
    (newFiles: File[], existingCount: number) => {
      setError("");
      const validFiles: File[] = [];

      for (const file of newFiles) {
        if (file.size > maxFileSize) {
          setError(
            `File "${file.name}" exceeds maximum size of ${(maxFileSize / 1024 / 1024).toFixed(0)}MB`,
          );
          continue;
        }
        validFiles.push(file);
      }

      const totalFiles = existingCount + validFiles.length;
      if (totalFiles > maxFiles) {
        setError(
          `Maximum ${maxFiles} files allowed. You're trying to add ${validFiles.length} file(s).`,
        );
        return [];
      }

      return validFiles;
    },
    [maxFileSize, maxFiles],
  );

  const handleAddFiles = useCallback(
    (newFiles: FileList | null) => {
      if (!newFiles) return;

      const validFiles = validateFiles(Array.from(newFiles), files.length);
      if (validFiles.length === 0) return;

      const newEntries = validFiles.map<UploadEntry>((file) => ({
        id: createId(),
        file,
        status: "pending",
      }));

      setFiles((prev) => {
        const updated = [...prev, ...newEntries];
        onFilesChange?.(updated.map((item) => item.file));
        return updated;
      });

      processEntries(newEntries);

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    },
    [files.length, onFilesChange, processEntries, validateFiles],
  );

  const handleRemoveFile = useCallback(
    (index: number) => {
      setFiles((prev) => {
        const target = prev[index];
        if (!target) return prev;

        const updated = prev.filter((_, i) => i !== index);

        onFilesChange?.(updated.map((item) => item.file));
        emitUploadedBlobs(updated);
        setError("");
        return updated;
      });
    },
    [emitUploadedBlobs, onFilesChange],
  );

  const handleClearFiles = useCallback(() => {
    setFiles([]);
    onFilesChange?.([]);
    emitUploadedBlobs([]);
    setError("");
  }, [emitUploadedBlobs, onFilesChange]);

  const handleRetryUpload = useCallback(
    (entry: UploadEntry) => {
      updateFileEntry(entry.id, {
        status: "pending",
        blob: undefined,
        error: undefined,
        progress: undefined,
      });
      void processEntry(entry);
    },
    [processEntry, updateFileEntry],
  );

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      handleAddFiles(event.target.files);
    },
    [handleAddFiles],
  );

  const openFileDialog = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return {
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
  };
};
