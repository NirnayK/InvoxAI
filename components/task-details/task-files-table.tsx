"use client";

import { Fragment, useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/tasks/columns";
import { TaskFileDetail, normalizeTaskStatus } from "@/lib/tasks";

interface TaskFilesTableProps {
  files: TaskFileDetail[];
}

const COLUMN_COUNT = 4;

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "Unknown";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const formatFileSize = (value: number) => {
  if (Number.isNaN(value) || value < 0) {
    return "Unknown size";
  }
  if (value < 1024) {
    return `${value} B`;
  }
  const units = ["KB", "MB", "GB", "TB"];
  let current = value;
  let index = 0;
  while (current >= 1024 && index < units.length - 1) {
    current /= 1024;
    index += 1;
  }
  return `${current.toFixed(1)} ${units[index]}`;
};

const truncatePath = (path: string) => {
  if (path.length <= 80) {
    return path;
  }
  const start = path.slice(0, 40);
  const end = path.slice(-35);
  return `${start}…${end}`;
};

export function TaskFilesTable({ files }: TaskFilesTableProps) {
  const [expandedFileId, setExpandedFileId] = useState<string | null>(null);

  const toggleDetails = useCallback(
    (fileId: string) => {
      setExpandedFileId((current) => (current === fileId ? null : fileId));
    },
    [setExpandedFileId],
  );

  const hasFiles = files.length > 0;

  const tableRows = useMemo(() => {
    if (!hasFiles) {
      return (
        <TableRow>
          <TableCell
            colSpan={COLUMN_COUNT}
            className="h-24 text-center text-sm text-muted-foreground"
          >
            No files attached to this task yet.
          </TableCell>
        </TableRow>
      );
    }

    return files.map((file) => {
      const isExpanded = file.id === expandedFileId;
      const formattedDate = formatDateTime(file.createdAt);
      const formattedStatus = normalizeTaskStatus(file.status);

      return (
        <Fragment key={file.id}>
          <TableRow className="data-[state=expanded]:bg-muted">
            <TableCell className="space-y-1">
              <p className="text-sm font-semibold text-foreground">{file.fileName}</p>
              <p className="text-xs text-muted-foreground">{file.mimeType ?? "Unknown format"}</p>
            </TableCell>
            <TableCell>
              <span className="text-sm text-muted-foreground">{formattedDate}</span>
            </TableCell>
            <TableCell>
              <StatusBadge status={formattedStatus} />
            </TableCell>
            <TableCell className="text-right">
              <Button
                size="sm"
                variant="outline"
                onClick={() => toggleDetails(file.id)}
                aria-expanded={isExpanded}
                type="button"
              >
                {isExpanded ? "Hide details" : "Show details"}
              </Button>
            </TableCell>
          </TableRow>
          {isExpanded && (
            <TableRow className="border-t border-border/50 bg-muted">
              <TableCell colSpan={COLUMN_COUNT} className="px-6 py-4 text-sm text-muted-foreground">
                <div className="grid gap-2 sm:grid-cols-2">
                  <p>
                    <span className="font-medium text-foreground">File ID:</span> {file.id}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Size:</span>{" "}
                    {formatFileSize(file.sizeBytes)}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Stored path:</span>{" "}
                    {truncatePath(file.path)}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Status:</span> {formattedStatus}
                  </p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </Fragment>
      );
    });
  }, [expandedFileId, files, hasFiles, toggleDetails]);

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>File</TableHead>
            <TableHead>Date added</TableHead>
            <TableHead>Processing status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>{tableRows}</TableBody>
      </Table>
    </div>
  );
}
