"use client";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import type { FileRecord } from "@/lib/files";
import { FileText } from "lucide-react";
import { useFileSelection } from "./use-file-selection";

interface ExportToXmlActionProps {
  selectedFiles: FileRecord[];
  disabled?: boolean;
  onRequestExport?: (targets: FileRecord[]) => void;
}

export function ExportToXmlAction({ selectedFiles, disabled = false, onRequestExport }: ExportToXmlActionProps) {
  const { processedFiles } = useFileSelection(selectedFiles);
  const hasSelection = processedFiles.length === selectedFiles.length && processedFiles.length > 0;
  const isDisabled = disabled || !hasSelection;

  return (
    <DropdownMenuItem
      disabled={isDisabled}
      onSelect={(event) => {
        if (isDisabled) {
          return;
        }
        event.preventDefault();
        onRequestExport?.([...selectedFiles]);
      }}
    >
      <FileText className="mr-2 h-4 w-4" />
      Save to XML
    </DropdownMenuItem>
  );
}
