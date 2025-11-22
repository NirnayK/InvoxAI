"use client";

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createLogger } from "@/lib/logger";
import { deleteFiles, type FileRecord } from "@/lib/files";
import { processFiles } from "@/lib/file-processing";
import { downloadSheet } from "@/lib/sheets";
import { isTauriRuntime } from "@/lib/database";
import { MoreHorizontal, Play, Save, Download, Trash2, X } from "lucide-react";

interface FileActionsProps {
  selectedFiles: FileRecord[];
  onProcessComplete?: () => void;
}

const logger = createLogger("FileActions");

export function FileActions({ selectedFiles, onProcessComplete }: FileActionsProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSavingSheet, setIsSavingSheet] = useState(false);
  const [isDownloadingFile, setIsDownloadingFile] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showSheetDialog, setShowSheetDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [sheetName, setSheetName] = useState("");
  const [deleteTargets, setDeleteTargets] = useState<FileRecord[]>([]);

  const unprocessedFiles = selectedFiles.filter((f) => f.status === "Unprocessed");
  const processedFiles = selectedFiles.filter((f) => f.status === "Processed");
  const hasSelection = selectedFiles.length > 0;

  const handleProcessClick = () => {
    if (!unprocessedFiles.length) {
      return;
    }
    const defaultName = `Invoice Processing ${new Date().toLocaleDateString()}`;
    setSheetName(defaultName);
    setShowSheetDialog(true);
  };

  const handleProcessConfirm = async () => {
    if (!sheetName.trim()) {
      return;
    }

    setShowSheetDialog(false);
    setIsProcessing(true);
    try {
      const result = await processFiles(unprocessedFiles, sheetName, {
        onStatusUpdate: (message) => {
          logger.debug("Processing update", { data: { message } });
        },
        onProgress: (processed, total) => {
          logger.debug("Processing progress", { data: { processed, total } });
        },
      });

      logger.info("Processing completed", {
        data: {
          processedFiles: result.processedFiles,
          failedFiles: result.failedFiles,
          sheetId: result.sheetId,
        },
      });

      onProcessComplete?.();
    } catch (error) {
      logger.error("Processing failed", { error });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateSheet = async () => {
    if (!processedFiles.length) {
      return;
    }
    const defaultName = `Invoice Sheet ${new Date().toLocaleDateString()}`;
    setSheetName(defaultName);
    setIsSavingSheet(true);

    try {
      const { createSheetForFiles } = await import("@/lib/sheets");
      const sheetId = await createSheetForFiles(
        processedFiles.map((f) => f.id),
        defaultName,
      );

      const result = await downloadSheet(sheetId);
      logger.info("Sheet generated", {
        data: { path: result.path, rows: result.rows },
      });
    } catch (error) {
      logger.error("Sheet generation failed", { error });
    } finally {
      setIsSavingSheet(false);
    }
  };

  const handleDownloadFiles = async () => {
    if (!hasSelection) {
      return;
    }
    setIsDownloadingFile(true);
    try {
      if (isTauriRuntime()) {
        const { open } = await import("@tauri-apps/api/shell");
        for (const file of selectedFiles) {
          await open(file.storedPath);
        }
      } else {
        await navigator.clipboard.writeText(selectedFiles.map((file) => file.storedPath).join("\n"));
      }
    } catch (error) {
      logger.error("File download failed", { error });
    } finally {
      setIsDownloadingFile(false);
    }
  };

  const handleDeleteFiles = () => {
    if (!hasSelection || !isTauriRuntime()) {
      return;
    }
    setDeleteTargets(selectedFiles);
    setShowDeleteDialog(true);
  };

  const confirmDeleteFiles = async () => {
    if (!deleteTargets.length) {
      return;
    }
    setIsDeleting(true);
    try {
      await deleteFiles(deleteTargets.map((file) => file.id));
      onProcessComplete?.();
      setShowDeleteDialog(false);
      setDeleteTargets([]);
    } catch (error) {
      logger.error("Failed to delete files", { error });
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelDeleteFiles = () => {
    if (isDeleting) {
      return;
    }
    setShowDeleteDialog(false);
    setDeleteTargets([]);
  };

  const disabledProcess = !unprocessedFiles.length || isProcessing;
  const disabledSaveSheet = !processedFiles.length || isSavingSheet;
  const disabledDownload = !hasSelection || isDownloadingFile;
  const disabledDelete = !hasSelection || isProcessing || !isTauriRuntime();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0 text-muted-foreground" aria-label="Open file actions">
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Open actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={disabledProcess} onClick={handleProcessClick}>
            <Play className="mr-2 h-4 w-4" />
            Process
          </DropdownMenuItem>
          <DropdownMenuItem disabled={disabledSaveSheet} onClick={handleGenerateSheet}>
            <Save className="mr-2 h-4 w-4" />
            Save to sheet
          </DropdownMenuItem>
          <DropdownMenuItem disabled={disabledDownload} onClick={handleDownloadFiles}>
            <Download className="mr-2 h-4 w-4" />
            Download file
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={disabledDelete}
            onClick={handleDeleteFiles}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {showSheetDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="relative w-full max-w-md p-6">
            <button
              onClick={() => setShowSheetDialog(false)}
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>

            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Process Files</h2>
                <p className="text-sm text-muted-foreground">
                  Enter a name for the processing batch. This will be used for the generated sheet.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sheet-name">Sheet Name</Label>
                <Input
                  id="sheet-name"
                  value={sheetName}
                  onChange={(e) => setSheetName(e.target.value)}
                  placeholder="e.g., Q4 2024 Invoices"
                />
              </div>

              <p className="text-sm text-muted-foreground">
                {unprocessedFiles.length} file(s) will be processed
              </p>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowSheetDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleProcessConfirm} disabled={!sheetName.trim()}>
                  Start Processing
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="relative w-full max-w-md p-6">
            <button
              onClick={cancelDeleteFiles}
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>

            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Delete files</h2>
                <p className="text-sm text-muted-foreground">
                  {deleteTargets.length} file{deleteTargets.length === 1 ? "" : "s"} will be permanently removed. This
                  cannot be undone.
                </p>
              </div>

              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                Make sure you have a backup before deleting local files.
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={cancelDeleteFiles} disabled={isDeleting}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={confirmDeleteFiles} disabled={isDeleting}>
                  {isDeleting ? "Deleting…" : "Delete"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
