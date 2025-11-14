"use client";

import type React from "react";
import { useCallback, useRef, useState } from "react";

import type { UploadEntry } from "./file-upload-types";

export interface FileUploadProps {
  maxFiles?: number;
  maxFileSize?: number;
  onFilesChange?: (files: File[]) => void;
  accept?: string;
}

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export const useFileUpload = ({
  maxFiles = 10,
  maxFileSize = 100 * 1024 * 1024,
  onFilesChange,
  accept = "*",
}: FileUploadProps = {}) => {
  const [files, setFiles] = useState<UploadEntry[]>([]);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const updateFileEntry = useCallback((id: string, changes: Partial<UploadEntry>) => {
    setFiles((prev) => {
      return prev.map((item) => (item.id === id ? { ...item, ...changes } : item));
    });
  }, []);

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
        status: "uploaded",
        progress: 100,
      }));

      setFiles((prev) => {
        const updated = [...prev, ...newEntries];
        onFilesChange?.(updated.map((item) => item.file));
        return updated;
      });

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    },
    [files.length, onFilesChange, validateFiles],
  );

  const handleRemoveFile = useCallback(
    (index: number) => {
      setFiles((prev) => {
        const target = prev[index];
        if (!target) return prev;

        const updated = prev.filter((_, i) => i !== index);

        onFilesChange?.(updated.map((item) => item.file));
        setError("");
        return updated;
      });
    },
    [onFilesChange],
  );

  const handleClearFiles = useCallback(() => {
    setFiles([]);
    onFilesChange?.([]);
    setError("");
  }, [onFilesChange]);

  const handleRetryUpload = useCallback(
    (entry: UploadEntry) => {
      updateFileEntry(entry.id, {
        status: "uploaded",
        error: undefined,
        progress: 100,
      });
    },
    [updateFileEntry],
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
