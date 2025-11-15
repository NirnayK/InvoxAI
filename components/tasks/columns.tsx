"use client";

import Link from "next/link";

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
  id: number;
  name: string;
  detail: string;
  files: string;
  lastActivity: string;
  status: string;
};

export type TaskActionContextValue = {
  isProcessing: boolean;
  processingTaskId: number | null;
  onProcessTask: (task: Task) => void;
  onRetryTask: (task: Task) => void;
  isDownloading: boolean;
  downloadingTaskId: number | null;
  onDownloadSheet: (task: Task) => void;
};

const TaskActionContext = React.createContext<TaskActionContextValue | null>(null);

export function TaskActionProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: TaskActionContextValue;
}) {
  return <TaskActionContext.Provider value={value}>{children}</TaskActionContext.Provider>;
}

function useTaskActions() {
  const context = React.useContext(TaskActionContext);
  if (!context) {
    throw new Error("Task action context is missing.");
  }
  return context;
}

export const STATUS_OPTIONS = [
  { label: "Unprocessed", value: "Unprocessed" },
  { label: "Processing", value: "Processing" },
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
  Processing: "default",
  Unprocessed: "outline",
};

function getStatusVariant(status: string): StatusBadgeVariant {
  return STATUS_VARIANT_MAP[status] ?? "default";
}

export function StatusBadge({ status }: { status: string }) {
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
  const {
    isProcessing,
    processingTaskId,
    onProcessTask,
    onRetryTask,
    isDownloading,
    downloadingTaskId,
    onDownloadSheet,
  } = useTaskActions();
  const actionLabel = task.status === "Failed" ? "Retry task" : "Process task";
  const isTaskBusy = processingTaskId === task.id;
  const isDownloadBusy = downloadingTaskId === task.id;
  const disabledReason =
    task.status === "Completed"
      ? "This task has already been completed."
      : isTaskBusy
        ? "This task is already processing."
        : isProcessing
          ? "Finish the current task before starting another."
          : undefined;
  const disableAction = Boolean(disabledReason);
  const downloadDisabled =
    (isDownloading && !isDownloadBusy) || task.status === "Processing" || task.status === "Queued";
  const handleAction = () => {
    if (task.status === "Failed") {
      onRetryTask(task);
      return;
    }
    onProcessTask(task);
  };

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
          <DropdownMenuItem asChild>
            <Link href={`/task?taskId=${task.id}`}>View details</Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={downloadDisabled}
            onClick={() => onDownloadSheet(task)}
            title={
              downloadDisabled && !isDownloadBusy
                ? "Finish the current download before starting another."
                : undefined
            }
          >
            {isDownloadBusy ? "Downloading…" : "Download sheet"}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={disableAction} onClick={handleAction} title={disabledReason}>
            {isTaskBusy ? "Processing…" : actionLabel}
          </DropdownMenuItem>
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
