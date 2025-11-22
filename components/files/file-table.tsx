"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, CheckSquare, FileText, Square } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FileRecord } from "@/lib/files";

interface FileTableProps {
  files: FileRecord[];
  selectedFiles: Set<string>;
  onSelectionChange: (selected: Set<string>) => void;
  onRefresh?: () => void;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
};

const formatRelativeTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
};

const getStatusBadge = (status: string) => {
  const variants: Record<
    string,
    { variant: "default" | "secondary" | "destructive" | "outline"; label: string }
  > = {
    Unprocessed: { variant: "outline", label: "Unprocessed" },
    Processing: { variant: "default", label: "Processing" },
    Processed: { variant: "secondary", label: "Processed" },
    Failed: { variant: "destructive", label: "Failed" },
  };

  const config = variants[status] || variants.Unprocessed;
  return (
    <Badge variant={config.variant} className="text-xs">
      {config.label}
    </Badge>
  );
};

type SortColumn = "fileName" | "sizeBytes" | "createdAt";
type SortOrder = "ASC" | "DESC";

export function FileTable({ files, selectedFiles, onSelectionChange, onRefresh }: FileTableProps) {
  const [sortBy, setSortBy] = useState<SortColumn>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("DESC");

  const toggleSelection = (fileId: string) => {
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(fileId)) {
      newSelection.delete(fileId);
    } else {
      newSelection.add(fileId);
    }
    onSelectionChange(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedFiles.size === files.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(files.map((f) => f.id)));
    }
  };

  const handleSort = (column: SortColumn) => {
    setSortBy((current) => {
      if (current === column) {
        setSortOrder((prev) => (prev === "ASC" ? "DESC" : "ASC"));
        return current;
      }
      setSortOrder("ASC");
      return column;
    });
  };

  const getSortIcon = (column: SortColumn) => {
    const isActive = sortBy === column;
    const Icon = !isActive ? ArrowUpDown : sortOrder === "ASC" ? ArrowUp : ArrowDown;
    return <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />;
  };

  const sortedFiles = [...files].sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case "fileName":
        comparison = a.fileName.localeCompare(b.fileName);
        break;
      case "sizeBytes":
        comparison = a.sizeBytes - b.sizeBytes;
        break;
      case "createdAt":
      default:
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
    }
    return sortOrder === "ASC" ? comparison : -comparison;
  });

  const allSelected = files.length > 0 && selectedFiles.size === files.length;

  const renderSortableHeader = (column: SortColumn, label: string) => {
    const isActive = sortBy === column;
    const iconClass = isActive ? "text-foreground" : "text-muted-foreground";
    return (
      <button
        type="button"
        onClick={() => handleSort(column)}
        className="flex items-center gap-2 text-left text-sm font-semibold text-foreground"
        aria-pressed={isActive}
      >
        <span>{label}</span>
        <span className={`inline-flex items-center ${iconClass}`} aria-hidden="true">
          {getSortIcon(column)}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {onRefresh ? (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onRefresh}>
            Refresh
          </Button>
        </div>
      ) : null}
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr className="border-b border-border">
              <th className="w-12 p-3 text-left">
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center justify-center rounded hover:bg-muted"
                  aria-label="Select all"
                >
                  {allSelected ? (
                    <CheckSquare className="h-4 w-4 text-foreground" />
                  ) : (
                    <Square className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </th>
              <th className="p-3 text-left text-sm font-semibold text-foreground">
                {renderSortableHeader("fileName", "File Name")}
              </th>
              <th className="p-3 text-left text-sm font-semibold text-foreground">
                {renderSortableHeader("sizeBytes", "Size")}
              </th>
              <th className="p-3 text-left text-sm font-semibold text-foreground">Status</th>
              <th className="p-3 text-left text-sm font-semibold text-foreground">
                {renderSortableHeader("createdAt", "Uploaded")}
              </th>
            </tr>
          </thead>
          <tbody>
            {files.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">
                  No files found. Upload files to get started.
                </td>
              </tr>
            ) : (
              sortedFiles.map((file) => (
                <tr
                  key={file.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="p-3">
                    <button
                      onClick={() => toggleSelection(file.id)}
                      className="flex items-center justify-center rounded hover:bg-muted"
                      aria-label={`Select ${file.fileName}`}
                    >
                      {selectedFiles.has(file.id) ? (
                        <CheckSquare className="h-4 w-4 text-foreground" />
                      ) : (
                        <Square className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">{file.fileName}</span>
                    </div>
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">
                    {formatFileSize(file.sizeBytes)}
                  </td>
                  <td className="p-3">{getStatusBadge(file.status)}</td>
                  <td className="p-3 text-sm text-muted-foreground">
                    {formatRelativeTime(file.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
