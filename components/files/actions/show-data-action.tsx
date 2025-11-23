"use client";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import type { FileRecord } from "@/lib/files";

interface ShowDataActionProps {
  selectedFiles: FileRecord[];
  variant?: "header" | "row";
  onShowData?: (file: FileRecord) => void;
}

export function ShowDataAction({ selectedFiles, variant = "header", onShowData }: ShowDataActionProps) {
  const canShowData = variant === "row" && selectedFiles.length === 1;

  if (!canShowData) {
    return null;
  }

  const handleShowData = () => {
    const target = selectedFiles[0];
    if (!target) return;
    onShowData?.(target);
  };

  return (
    <DropdownMenuItem onSelect={() => handleShowData()}>
      <MoreHorizontal className="mr-2 h-4 w-4" />
      Show data
    </DropdownMenuItem>
  );
}
