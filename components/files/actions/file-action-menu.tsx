"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FileRecord } from "@/lib/files";
import { Loader2, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { useFileMutations } from "@/lib/hooks/use-files";
import { saveFile } from "@/lib/filesystem";
import { convertToInvoiceData, generateTallyXml } from "@/lib/xml/xml-generator";
import { save } from "@tauri-apps/plugin-dialog";
import { XmlSelectionDialog } from "../xml-selection-dialog";
import { DeleteFilesAction } from "./delete-files-action";
import { DownloadFilesAction } from "./download-files-action";
import { ExportToXmlAction } from "./export-to-xml-action";
import { ProcessFilesAction } from "./process-files-action";
import { ShowDataAction } from "./show-data-action";

export interface FileActionsProps {
  selectedFiles: FileRecord[];
  onProcessComplete?: () => void;
  onDeleteComplete?: () => void;
  variant?: "header" | "row";
}

export function FileActionMenu({
  selectedFiles,
  onProcessComplete,
  onDeleteComplete,
  variant = "header",
}: FileActionsProps) {
  const [previewFile, setPreviewFile] = useState<FileRecord | null>(null);
  const [dataPreview, setDataPreview] = useState<string>("");
  const [deleteTargets, setDeleteTargets] = useState<FileRecord[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [xmlDialogOpen, setXmlDialogOpen] = useState(false);
  const [xmlTargets, setXmlTargets] = useState<FileRecord[]>([]);
  const [generatingXml, setGeneratingXml] = useState(false);
  const [processingDialogOpen, setProcessingDialogOpen] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>("");
  const [processingProgress, setProcessingProgress] = useState<{
    processed: number;
    total: number;
  } | null>(null);
  const {
    deleteFiles,
    createXml,
    appendXml,
    generateXml: generateXmlMutation,
    processFiles,
  } = useFileMutations();

  const handleShowData = (file: FileRecord) => {
    let content = file.parsedDetails ?? "No extracted data yet.";
    try {
      const parsed = JSON.parse(content);
      content = JSON.stringify(parsed, null, 2);
    } catch {
      // keep original content when parsing fails
    }
    setPreviewFile(file);
    setDataPreview(content);
  };

  const closePreview = () => {
    setPreviewFile(null);
    setDataPreview("");
  };

  const handleRequestDelete = (targets: FileRecord[]) => {
    if (!targets.length) {
      return;
    }
    setDeleteTargets(targets);
    setDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    if (deleteFiles.isPending) {
      return;
    }
    setDeleteDialogOpen(false);
    setDeleteTargets([]);
  };

  const confirmDelete = async () => {
    if (!deleteTargets.length) {
      return;
    }
    try {
      const fileIds = deleteTargets.map((file) => file.id);
      await deleteFiles.mutateAsync(fileIds);
      toast.success(`Deleted ${deleteTargets.length} files.`);
      onDeleteComplete?.();
      onProcessComplete?.(); // refresh list
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete files.");
    } finally {
      setDeleteDialogOpen(false);
      setDeleteTargets([]);
    }
  };

  const handleRequestExport = (targets: FileRecord[]) => {
    if (!targets.length) {
      return;
    }
    setXmlTargets(targets);
    setXmlDialogOpen(true);
  };

  const handleRequestProcess = async (targets: FileRecord[]) => {
    if (!targets.length) {
      return;
    }
    setProcessingDialogOpen(true);
    setProcessingStatus("Preparing files...");
    setProcessingProgress({ processed: 0, total: targets.length });

    try {
      const result = await processFiles.mutateAsync({
        files: targets,
        options: {
          onStatusUpdate: (message) => setProcessingStatus(message),
          onProgress: (processed, total) => setProcessingProgress({ processed, total }),
        },
      });

      if (result.processedFiles > 0) {
        toast.success(`Successfully processed ${result.processedFiles} files.`);
      }
      if (result.failedFiles > 0) {
        toast.error(`Failed to process ${result.failedFiles} files.`);
      }
      onProcessComplete?.();
    } catch (error) {
      console.error("Processing error:", error);
      toast.error("An error occurred while processing files.");
    } finally {
      setProcessingDialogOpen(false);
      setProcessingProgress(null);
      setProcessingStatus("");
    }
  };

  const handleXmlConfirm = async (mode: "new" | "append", nameOrId: string | number) => {
    if (!xmlTargets.length) {
      return;
    }
    setGeneratingXml(true);
    try {
      const fileIds = xmlTargets.map((file) => file.id);
      let xmlId: number;

      if (mode === "new") {
        xmlId = await createXml.mutateAsync({
          fileIds,
          xmlName: nameOrId as string,
        });
      } else {
        xmlId = nameOrId as number;
        await appendXml.mutateAsync({
          xmlId,
          fileIds,
        });
      }

      const result = await generateXmlMutation.mutateAsync(xmlId);

      const invoices = result.content
        .split("\n")
        .filter((line: string) => line.trim().length > 0)
        .map((line: string) => {
          try {
            return convertToInvoiceData(JSON.parse(line));
          } catch (error) {
            console.error("Failed to parse invoice JSON:", error);
            return null;
          }
        })
        .filter(
          (item): item is NonNullable<ReturnType<typeof convertToInvoiceData>> => item !== null,
        );

      if (invoices.length === 0) {
        toast.error("No valid invoice data found to export.");
        return;
      }

      const xmlContent = generateTallyXml(invoices);

      const savePath = await save({
        filters: [
          {
            name: "XML",
            extensions: ["xml"],
          },
        ],
        defaultPath: `invox-export-${new Date().toISOString().slice(0, 10)}.xml`,
      });

      if (savePath) {
        await saveFile(savePath, xmlContent);
        toast.success(`Successfully exported to XML: ${savePath}`);
      }
    } catch (error) {
      console.error("XML export error:", error);
      toast.error("Failed to export XML.");
    } finally {
      setGeneratingXml(false);
      setXmlTargets([]);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-8 w-8 p-0 text-muted-foreground"
            aria-label="Open file actions"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Open actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <ProcessFilesAction
            selectedFiles={selectedFiles}
            disabled={processFiles.isPending}
            onRequestProcess={handleRequestProcess}
          />

          <ExportToXmlAction
            selectedFiles={selectedFiles}
            disabled={generatingXml}
            onRequestExport={handleRequestExport}
          />

          <DownloadFilesAction selectedFiles={selectedFiles} />

          <ShowDataAction
            selectedFiles={selectedFiles}
            variant={variant}
            onShowData={handleShowData}
          />

          <DropdownMenuSeparator />

          <DeleteFilesAction selectedFiles={selectedFiles} onRequestDelete={handleRequestDelete} />
        </DropdownMenuContent>
      </DropdownMenu>

      {previewFile ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="relative flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg border bg-background p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Extracted Data</h2>
                <p className="text-xs text-muted-foreground">{previewFile.fileName}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={closePreview}>
                Close
              </Button>
            </div>
            <pre className="flex-1 overflow-auto rounded-md bg-muted p-4 text-xs text-muted-foreground whitespace-pre-wrap">
              {dataPreview}
            </pre>
          </div>
        </div>
      ) : null}

      {deleteDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="relative w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
            <h2 className="text-lg font-semibold">Delete files</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {deleteTargets.length} file{deleteTargets.length === 1 ? "" : "s"} will be permanently
              removed.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={closeDeleteDialog}
                disabled={deleteFiles.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={deleteFiles.isPending}
              >
                {deleteFiles.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Delete
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {xmlDialogOpen ? (
        <XmlSelectionDialog
          open={xmlDialogOpen}
          onOpenChange={(open) => {
            if (!open && generatingXml) {
              return;
            }
            setXmlDialogOpen(open);
            if (!open) {
              setXmlTargets([]);
            }
          }}
          onConfirm={handleXmlConfirm}
          fileCount={xmlTargets.length}
        />
      ) : null}

      {processingDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="relative w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div>
                <h2 className="text-lg font-semibold">Processing files</h2>
                <p className="text-sm text-muted-foreground">{processingStatus || "Starting..."}</p>
              </div>
            </div>
            {processingProgress ? (
              <div className="mt-4 text-sm text-muted-foreground">
                Processed {processingProgress.processed} of {processingProgress.total}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
