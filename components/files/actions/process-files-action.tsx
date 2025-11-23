"use client";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import type { FileRecord } from "@/lib/files";
import { Play } from "lucide-react";
import { toast } from "sonner";
import { useFileSelection } from "./use-file-selection";
import { useFileMutations } from "@/lib/hooks/use-files";

interface ProcessFilesActionProps {
  selectedFiles: FileRecord[];
  onProcessComplete?: () => void;
}

export function ProcessFilesAction({ selectedFiles, onProcessComplete }: ProcessFilesActionProps) {
  const { processFiles } = useFileMutations();
  const { unprocessedFiles } = useFileSelection(selectedFiles);

  const handleProcessClick = async () => {
    if (unprocessedFiles.length === 0) return;

    try {
      const result = await processFiles.mutateAsync({
        files: unprocessedFiles,
      });

      const successCount = result.processedFiles;
      const failedCount = result.failedFiles;

      if (successCount > 0) {
        toast.success(`Successfully processed ${successCount} files.`);
      }
      if (failedCount > 0) {
        toast.error(`Failed to process ${failedCount} files.`);
      }

      onProcessComplete?.();
    } catch (error) {
      console.error("Processing error:", error);
      toast.error("An error occurred while processing files.");
    }
  };

  return (
    <DropdownMenuItem disabled={unprocessedFiles.length === 0 || processFiles.isPending} onClick={handleProcessClick}>
      <Play className="mr-2 h-4 w-4" />
      Process
    </DropdownMenuItem>
  );
}
