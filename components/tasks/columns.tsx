"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { DataTableColumnHeader } from "./data-table-column-header";

export type Task = {
  name: string;
  detail: string;
  files: string;
  lastActivity: string;
  status: string;
};

export const STATUS_OPTIONS = [
  { label: "Completed", value: "Completed" },
  { label: "Failed", value: "Failed" },
  { label: "Cancelled", value: "Cancelled" },
  { label: "Queued", value: "Queued" },
  { label: "In Progress", value: "In Progress" },
] as const;

type StatusBadgeVariant = NonNullable<React.ComponentProps<typeof Badge>["variant"]>;

const STATUS_VARIANT_MAP: Record<string, StatusBadgeVariant> = {
  Completed: "secondary",
  Failed: "destructive",
  Cancelled: "destructive",
  Queued: "outline",
};

function getStatusVariant(status: string): StatusBadgeVariant {
  return STATUS_VARIANT_MAP[status] ?? "default";
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant={getStatusVariant(status)}
      className="px-2.5 py-1 text-[11px] font-semibold tracking-wide"
    >
      {status}
    </Badge>
  );
}

function TaskRowActions({ task }: { task: Task }) {
  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => navigator.clipboard.writeText(task.name)}>
            Copy task name
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>View details</DropdownMenuItem>
          <DropdownMenuItem>Retry task</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive">Cancel task</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export const columns: ColumnDef<Task>[] = [
  {
    id: "select",
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
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Task" />,
    cell: ({ row }) => (
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{row.original.name}</p>
        <p className="text-xs text-muted-foreground">{row.original.detail}</p>
      </div>
    ),
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
    accessorKey: "files",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Files Uploaded" />,
    cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.files}</span>,
  },
  {
    accessorKey: "lastActivity",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Last Activity" />,
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{row.original.lastActivity}</span>
    ),
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => <TaskRowActions task={row.original} />,
  },
];
