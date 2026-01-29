"use client";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import type { FileRecord } from "@/lib/files";
import { Play } from "lucide-react";
import { useFileSelection } from "./use-file-selection";

interface ProcessFilesActionProps {
  selectedFiles: FileRecord[];
  disabled?: boolean;
  onRequestProcess?: (files: FileRecord[]) => void;
}

export function ProcessFilesAction({
  selectedFiles,
  disabled = false,
  onRequestProcess,
}: ProcessFilesActionProps) {
  const { unprocessedFiles } = useFileSelection(selectedFiles);
  const isDisabled = disabled || unprocessedFiles.length === 0;

  const handleProcessClick = () => {
    if (isDisabled) {
      return;
    }
    onRequestProcess?.([...unprocessedFiles]);
  };

  return (
    <DropdownMenuItem disabled={isDisabled} onSelect={handleProcessClick}>
      <Play className="mr-2 h-4 w-4" />
      Process
    </DropdownMenuItem>
  );
}
