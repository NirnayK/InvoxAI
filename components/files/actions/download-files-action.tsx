"use client";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Download } from "lucide-react";
import type { FileRecord } from "@/lib/files";
import { FileCommands } from "@/lib/files";
import { isTauriRuntime } from "@/lib/database";
import { createLogger } from "@/lib/logger";
import { useState } from "react";
import { toast } from "sonner";
import { save } from "@tauri-apps/plugin-dialog";
import { useFileSelection } from "./use-file-selection";

interface DownloadFilesActionProps {
  selectedFiles: FileRecord[];
}

const logger = createLogger("DownloadFilesAction");

export function DownloadFilesAction({ selectedFiles }: DownloadFilesActionProps) {
  const { hasSelection } = useFileSelection(selectedFiles);
  const runtimeReady = isTauriRuntime();
  const [saving, setSaving] = useState(false);
  const disabled = !hasSelection || !runtimeReady || saving;

  const handleDownloadFiles = async () => {
    if (!hasSelection) return;
    if (!runtimeReady) {
      toast.error("Downloading files requires the Invox desktop runtime.");
      return;
    }

    setSaving(true);
    let savedCount = 0;
    let errorCount = 0;

    try {
      for (const file of selectedFiles) {
        try {
          const defaultName = file.fileName || `file-${file.id}`;
          const destination = await save({
            defaultPath: defaultName,
          });

          if (!destination) {
            continue;
          }

          await FileCommands.copyFileToPath(file.storedPath, destination);
          savedCount += 1;
        } catch (error) {
          errorCount += 1;
          logger.error("File download failed", { error, data: { fileId: file.id } });
        }
      }
    } finally {
      setSaving(false);
    }

    if (savedCount > 0) {
      toast.success(`Saved ${savedCount} file${savedCount === 1 ? "" : "s"} to disk.`);
    }

    if (errorCount > 0) {
      toast.error(`Failed to save ${errorCount} file${errorCount === 1 ? "" : "s"}.`);
    }
  };

  return (
    <DropdownMenuItem disabled={disabled} onSelect={handleDownloadFiles}>
      <Download className="mr-2 h-4 w-4" />
      Save file
    </DropdownMenuItem>
  );
}
