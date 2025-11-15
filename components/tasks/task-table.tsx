"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { downloadSheetForTask } from "@/lib/sheets";
import { processTaskById } from "@/lib/task-processing";
import { toast } from "sonner";
import { createLogger } from "@/lib/logger";

import type { Task } from "./columns";
import { TaskActionProvider, columns } from "./columns";
import { DataTable } from "./data-table";

export { type Task } from "./columns";

const PROCESSING_DURATION_MS = 60 * 1000;
const PROGRESS_INTERVAL_MS = 250;
const downloadLogger = createLogger("SheetDownload");

type ProcessingMode = "process" | "retry";

interface ActiveTaskState {
  taskId: number;
  taskName: string;
  mode: ProcessingMode;
}

interface TaskTableProps {
  tasks: Task[];
  onTaskUpdated?: (taskId: number) => void;
}

export function TaskTable({ tasks, onTaskUpdated }: TaskTableProps) {
  const [rows, setRows] = useState<Task[]>(tasks);
  const [activeTask, setActiveTask] = useState<ActiveTaskState | null>(null);
  const [processingTaskId, setProcessingTaskId] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState(
    "Please keep this window open while we run your task.",
  );
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [downloadingTaskId, setDownloadingTaskId] = useState<number | null>(null);

  useEffect(() => {
    setRows(tasks);
  }, [tasks]);

  const startProcessing = useCallback(
    (task: Task, mode: ProcessingMode) => {
      if (processingTaskId && processingTaskId !== task.id) {
        return;
      }

      setRows((prev) =>
        prev.map((row) => (row.id === task.id ? { ...row, status: "Processing" } : row)),
      );
      setProcessingTaskId(task.id);
      setActiveTask({ taskId: task.id, taskName: task.name, mode });
      setIsModalOpen(true);
      setProgress(0);
      setProcessingError(null);
      setModalMessage("Preparing files for Gemini...");
    },
    [processingTaskId],
  );

  const handleProcessTask = useCallback(
    (task: Task) => startProcessing(task, "process"),
    [startProcessing],
  );

  const handleRetryTask = useCallback(
    (task: Task) => startProcessing(task, "retry"),
    [startProcessing],
  );

  const handleDownloadSheet = useCallback(
    async (task: Task) => {
      if (processingTaskId && processingTaskId !== task.id) {
        toast("Wait for the current task to finish before downloading its sheet.");
        return;
      }
      if (downloadingTaskId && downloadingTaskId !== task.id) {
        toast("A sheet download is already in progress. Please wait a moment.");
        return;
      }

      setDownloadingTaskId(task.id);
      toast("Preparing your sheet download...");
      downloadLogger.info("Starting sheet download", {
        data: { taskId: task.id, taskName: task.name },
      });
      try {
        const result = await downloadSheetForTask(task.id);
        downloadLogger.info("Sheet download succeeded", {
          data: { taskId: task.id, rows: result.rows, path: result.path },
        });
        toast.success(`Copied ${result.rows} row(s) to ${result.path}`);
      } catch (error) {
        downloadLogger.error("Sheet download failed", {
          data: { taskId: task.id, taskName: task.name },
          error,
        });
        const message =
          error instanceof Error ? error.message : "Failed to download the sheet for this task.";
        toast.error(message);
      } finally {
        setDownloadingTaskId(null);
      }
    },
    [downloadingTaskId, processingTaskId],
  );

  useEffect(() => {
    if (!processingTaskId || !isModalOpen) {
      return;
    }

    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 95) {
          return current;
        }
        const elapsed = Date.now() - startedAt;
        const projected = Math.min((elapsed / PROCESSING_DURATION_MS) * 100, 95);
        return Math.max(current, projected);
      });
    }, PROGRESS_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [processingTaskId, isModalOpen]);

  useEffect(() => {
    if (!activeTask) {
      return;
    }

    let cancelled = false;

    const getFriendlyProcessingError = (error: unknown) => {
      if (error instanceof Error) {
        if (error.message.length > 200 || error.message.trim().startsWith("{")) {
          return "Something went wrong while processing this task.";
        }
        return error.message;
      }
      return "Something went wrong while processing this task.";
    };

    const run = async () => {
      try {
        await processTaskById(activeTask.taskId, {
          onStatusUpdate: (message) => {
            if (!cancelled) {
              setModalMessage(message);
            }
          },
        });
        if (cancelled) {
          return;
        }

        setRows((prev) =>
          prev.map((row) => (row.id === activeTask.taskId ? { ...row, status: "Completed" } : row)),
        );
        setProcessingError(null);
        setProgress(100);
        setModalMessage("Task completed successfully.");
        setProcessingTaskId(null);
        onTaskUpdated?.(activeTask.taskId);
        window.setTimeout(() => {
          if (!cancelled) {
            setIsModalOpen(false);
            setActiveTask(null);
            setProgress(0);
            setModalMessage("Please keep this window open while we run your task.");
          }
        }, 900);
      } catch (error) {
        if (cancelled) {
          return;
        }
        const message = getFriendlyProcessingError(error);
        setProcessingError(message);
        setModalMessage("Processing failed.");
        setRows((prev) =>
          prev.map((row) => (row.id === activeTask.taskId ? { ...row, status: "Failed" } : row)),
        );
        setProcessingTaskId(null);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [activeTask, onTaskUpdated]);

  const handleModalDismiss = () => {
    setIsModalOpen(false);
    setActiveTask(null);
    setProgress(0);
    setProcessingError(null);
    setModalMessage("Please keep this window open while we run your task.");
  };

  const providerValue = useMemo(
    () => ({
      isProcessing: Boolean(processingTaskId),
      processingTaskId,
      onProcessTask: handleProcessTask,
      onRetryTask: handleRetryTask,
      isDownloading: Boolean(downloadingTaskId),
      downloadingTaskId,
      onDownloadSheet: handleDownloadSheet,
    }),
    [processingTaskId, handleProcessTask, handleRetryTask, downloadingTaskId, handleDownloadSheet],
  );

  return (
    <TaskActionProvider value={providerValue}>
      <DataTable columns={columns} data={rows} />
      <ProcessingModal
        isOpen={isModalOpen}
        progress={progress}
        mode={activeTask?.mode ?? "process"}
        taskName={activeTask?.taskName ?? ""}
        message={modalMessage}
        error={processingError}
        onDismiss={handleModalDismiss}
      />
    </TaskActionProvider>
  );
}

function ProcessingModal({
  isOpen,
  progress,
  mode,
  taskName,
  message,
  error,
  onDismiss,
}: {
  isOpen: boolean;
  progress: number;
  mode: ProcessingMode;
  taskName: string;
  message: string;
  error: string | null;
  onDismiss: () => void;
}) {
  if (!isOpen || !taskName) {
    return null;
  }

  const statusText = error ?? `${Math.round(progress)}%`;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/80 px-4 py-8 backdrop-blur">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          Task {mode === "retry" ? "retry" : "processing"}
        </p>
        <h3 className="mt-2 text-xl font-semibold text-foreground">{taskName}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <div className="mt-6 h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${
              error ? "bg-destructive" : "bg-primary"
            } transition-[width] duration-300 ease-linear`}
            style={{ width: `${error ? 100 : progress}%` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between text-xs font-semibold">
          <span className={error ? "text-destructive" : "text-muted-foreground"}>{statusText}</span>
          {error && (
            <Button
              size="sm"
              className="h-7 rounded-full px-3 text-xs font-semibold"
              onClick={onDismiss}
            >
              Close
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
