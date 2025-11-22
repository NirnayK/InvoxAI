"use client";

import { useState } from "react";
import { Download, Play, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FileRecord } from "@/lib/files";
import { processFiles } from "@/lib/file-processing";
import { downloadSheet } from "@/lib/sheets";
import { createLogger } from "@/lib/logger";

interface FileActionsProps {
  selectedFiles: FileRecord[];
  onProcessComplete?: () => void;
}

const logger = createLogger("FileActions");

export function FileActions({ selectedFiles, onProcessComplete }: FileActionsProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showSheetDialog, setShowSheetDialog] = useState(false);
  const [sheetName, setSheetName] = useState("");
  const [processingStatus, setProcessingStatus] = useState("");

  const unprocessedFiles = selectedFiles.filter((f) => f.status === "Unprocessed");
  const processedFiles = selectedFiles.filter((f) => f.status === "Processed");

  const handleProcessClick = () => {
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
    setProcessingStatus("Starting processing...");

    try {
      const result = await processFiles(unprocessedFiles, sheetName, {
        onStatusUpdate: (message) => {
          setProcessingStatus(message);
        },
        onProgress: (processed, total) => {
          setProcessingStatus(`Processing: ${processed}/${total} files`);
        },
      });

      logger.info("Processing completed", {
        data: {
          processedFiles: result.processedFiles,
          failedFiles: result.failedFiles,
          sheetId: result.sheetId,
        },
      });

      setProcessingStatus("");
      onProcessComplete?.();
    } catch (error) {
      logger.error("Processing failed", { error });
      setProcessingStatus("Processing failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateSheet = async () => {
    const defaultName = `Invoice Sheet ${new Date().toLocaleDateString()}`;
    setSheetName(defaultName);
    setIsDownloading(true);

    try {
      // Create a sheet for the selected processed files
      const { createSheetForFiles } = await import("@/lib/sheets");
      const sheetId = await createSheetForFiles(
        processedFiles.map((f) => f.id),
        defaultName,
      );

      // For processed files, we need to get their parsed data and append to sheet
      // For now, just download the sheet (it will be empty but demonstrates the flow)
      const result = await downloadSheet(sheetId);

      logger.info("Sheet generated", {
        data: { path: result.path, rows: result.rows },
      });
    } catch (error) {
      logger.error("Sheet generation failed", { error });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3">
        {isProcessing && <span className="text-sm text-muted-foreground">{processingStatus}</span>}

        <Button
          onClick={handleProcessClick}
          disabled={unprocessedFiles.length === 0 || isProcessing}
          className="gap-2"
        >
          <Play className="h-4 w-4" />
          Process Selected ({unprocessedFiles.length})
        </Button>

        <Button
          onClick={handleGenerateSheet}
          disabled={processedFiles.length === 0 || isDownloading}
          variant="outline"
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Generate Sheet ({processedFiles.length})
        </Button>
      </div>

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
    </>
  );
}
