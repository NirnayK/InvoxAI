"use client";

import type { ColumnDef } from "@tanstack/react-table";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { FileRecord } from "@/lib/files";
import { FILE_STATUS } from "@/lib/constants";

import { DataTableColumnHeader } from "./data-table-column-header";

export type FileModel = FileRecord;

export const STATUS_OPTIONS = [
  { label: "Unprocessed", value: FILE_STATUS.UNPROCESSED },
  { label: "Processing", value: FILE_STATUS.PROCESSING },
  { label: "Processed", value: FILE_STATUS.PROCESSED },
  { label: "Failed", value: FILE_STATUS.FAILED },
] as const;

type StatusBadgeVariant = NonNullable<React.ComponentProps<typeof Badge>["variant"]>;

const STATUS_VARIANT_MAP: Record<string, StatusBadgeVariant> = {
  [FILE_STATUS.UNPROCESSED]: "outline",
  [FILE_STATUS.PROCESSING]: "default",
  [FILE_STATUS.PROCESSED]: "secondary",
  Completed: "secondary",
  [FILE_STATUS.FAILED]: "destructive",
  Cancelled: "destructive",
};

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatAbsoluteDate(value?: string | null) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function formatRelativeTime(value?: string | null) {
  const parsed = formatAbsoluteDate(value);
  if (!parsed) {
    return "Unknown";
  }
  const diff = Date.now() - parsed.getTime();
  const seconds = Math.round(Math.abs(diff) / 1000);
  if (seconds < 5) {
    return diff >= 0 ? "Just now" : "In a few seconds";
  }
  if (seconds < 60) {
    return `${seconds}s ${diff >= 0 ? "ago" : "from now"}`;
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ${diff >= 0 ? "ago" : "from now"}`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ${diff >= 0 ? "ago" : "from now"}`;
  }
  const days = Math.round(hours / 24);
  return `${days}d ${diff >= 0 ? "ago" : "from now"}`;
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_VARIANT_MAP[status] ?? "outline"} className="px-2.5 py-1 text-[11px]">
      {status}
    </Badge>
  );
}

const getUpdatedTimestamp = (file: FileModel) =>
  file.updatedAt ?? file.processedAt ?? file.createdAt;

export const columns: ColumnDef<FileModel>[] = [
  {
    id: "select",
    enableSorting: false,
    enableHiding: false,
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
        className="translate-y-[2px]"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        className="translate-y-[2px]"
      />
    ),
  },
  {
    accessorKey: "fileName",
    header: ({ column }) => <DataTableColumnHeader column={column} title="File" />,
    cell: ({ row }) => {
      const file = row.original;
      return (
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">{file.fileName}</p>
          <p className="text-xs text-muted-foreground">
            {file.mimeType ?? "Unknown format"} · {formatFileSize(file.sizeBytes)}
          </p>
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
    filterFn: (row, id, value) => {
      if (!value?.length) {
        return true;
      }
      return (value as string[]).includes(row.getValue(id) as string);
    },
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Uploaded" />,
    cell: ({ row }) => {
      const created = formatAbsoluteDate(row.original.createdAt);
      const relative = formatRelativeTime(row.original.createdAt);
      return (
        <span
          className="text-sm text-muted-foreground"
          title={created?.toLocaleString() ?? undefined}
        >
          {relative}
        </span>
      );
    },
  },
  {
    accessorKey: "updatedAt",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Last updated" />,
    cell: ({ row }) => {
      const timestamp = getUpdatedTimestamp(row.original);
      const absolute = formatAbsoluteDate(timestamp);
      return (
        <span
          className="text-sm text-muted-foreground"
          title={absolute?.toLocaleString() ?? undefined}
        >
          {formatRelativeTime(timestamp)}
        </span>
      );
    },
  },
];
