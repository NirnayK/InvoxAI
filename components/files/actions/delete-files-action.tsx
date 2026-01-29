"use client";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Trash2 } from "lucide-react";
import type { FileRecord } from "@/lib/files";
import { isTauriRuntime } from "@/lib/database";

interface DeleteFilesActionProps {
  selectedFiles: FileRecord[];
  disabled?: boolean;
  onRequestDelete?: (targets: FileRecord[]) => void;
}

export function DeleteFilesAction({
  selectedFiles,
  disabled = false,
  onRequestDelete,
}: DeleteFilesActionProps) {
  const hasSelection = selectedFiles.length > 0;
  const runtimeReady = isTauriRuntime();
  const isDisabled = disabled || !hasSelection || !runtimeReady;

  return (
    <DropdownMenuItem
      disabled={isDisabled}
      className="text-destructive focus:text-destructive"
      onSelect={(event) => {
        if (isDisabled) {
          return;
        }
        event.preventDefault();
        onRequestDelete?.([...selectedFiles]);
      }}
    >
      <Trash2 className="mr-2 h-4 w-4" />
      Delete
    </DropdownMenuItem>
  );
}
