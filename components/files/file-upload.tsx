"use client";

import { type ChangeEvent, type DragEvent, type KeyboardEvent } from "react";
import { Upload } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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

  const dropZoneState = cn(
    "group relative flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center transition",
    "hover:border-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
    files.length === 0 ? "bg-background" : "bg-card/60",
  );

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer?.files) {
      const syntheticEvent = {
        target: { files: event.dataTransfer.files },
      } as ChangeEvent<HTMLInputElement>;
      handleInputChange(syntheticEvent);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openFileDialog();
    }
  };

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        onChange={handleInputChange}
        className="hidden"
        aria-label="Upload files"
      />

      <Card className="rounded-[22px] border-dashed border-border/60 bg-card/80 shadow-none">
        <CardContent className="px-4 py-6">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onDrop={handleDrop}
            className={dropZoneState}
            role="button"
            tabIndex={0}
            onClick={openFileDialog}
            onKeyDown={handleKeyDown}
          >
            <Upload className="size-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Drag files here or click to add</p>
            <p className="text-xs text-muted-foreground">
              Max {maxFiles} files • {(maxFileSize / 1024 / 1024).toFixed(0)}MB each
            </p>
            <Button variant="outline" className="mt-2">
              Browse files
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
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
