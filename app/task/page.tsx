"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Inbox } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { TaskFilesTable } from "@/components/task-details/task-files-table";
import { TaskFileDetail, type TaskDetail, getTaskWithFiles, normalizeTaskStatus } from "@/lib/tasks";
import { isTauriRuntime } from "@/lib/database";
import { createLogger } from "@/lib/logger";

const taskDetailsLogger = createLogger("TaskDetailsPage");

export default function TaskDetailsPage() {
  const searchParams = useSearchParams();
  const taskIdParam = searchParams?.get("taskId") ?? null;

  const [taskDetail, setTaskDetail] = useState<TaskDetail | null>(null);
  const [taskFiles, setTaskFiles] = useState<TaskFileDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [runtimeChecked, setRuntimeChecked] = useState(false);
  const [tauriAvailable, setTauriAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryIndex, setRetryIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const available = isTauriRuntime();
      if (cancelled) {
        return;
      }

      setRuntimeChecked(true);
      setTauriAvailable(available);

      if (!available) {
        setError("Start the Invox desktop shell to view task details.");
        setIsLoading(false);
        setTaskDetail(null);
        setTaskFiles([]);
        return;
      }

      if (!taskIdParam) {
        setError("Select a task from the dashboard to view its attachments.");
        setTaskDetail(null);
        setTaskFiles([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      const taskId = Number(taskIdParam);
      if (Number.isNaN(taskId)) {
        setTaskDetail(null);
        setTaskFiles([]);
        setError("Invalid task identifier.");
        setIsLoading(false);
        return;
      }

      try {
        const result = await getTaskWithFiles(taskId);
        if (cancelled) {
          return;
        }
        if (!result) {
          setTaskDetail(null);
          setTaskFiles([]);
          setError("Unable to find that task.");
          return;
        }
        setTaskDetail(result.detail);
        setTaskFiles(result.files);
      } catch (loadError) {
        taskDetailsLogger.error("Failed to load files for task", {
          error: loadError,
          data: { taskId },
        });
        if (!cancelled) {
          setTaskDetail(null);
          setTaskFiles([]);
          setError("Something went wrong while loading the task.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [taskIdParam, retryIndex]);

  const handleRetry = () => setRetryIndex((value) => value + 1);

  const shouldShowLoadingState = isLoading && !error;
  const shouldShowTauriState = runtimeChecked && !tauriAvailable;

  const content = useMemo(() => {
    if (shouldShowLoadingState) {
      return (
        <Empty className="mt-6">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Inbox className="h-6 w-6" />
            </EmptyMedia>
            <EmptyTitle>Loading task details</EmptyTitle>
            <EmptyDescription>Retrieving attached files from the local database.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      );
    }

    if (shouldShowTauriState) {
      return (
        <Empty className="mt-6">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Inbox className="h-6 w-6" />
            </EmptyMedia>
            <EmptyTitle>Desktop runtime required</EmptyTitle>
            <EmptyDescription>Launch the Invox shell (pnpm tauri:dev) to continue.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              variant="outline"
              className="rounded-2xl px-5 py-2 text-sm font-semibold"
              onClick={handleRetry}
            >
              Retry
            </Button>
          </EmptyContent>
        </Empty>
      );
    }

    if (error) {
      return (
        <Empty className="mt-6">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Inbox className="h-6 w-6" />
            </EmptyMedia>
            <EmptyTitle>Unable to load task</EmptyTitle>
            <EmptyDescription>{error}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              variant="outline"
              className="rounded-2xl px-5 py-2 text-sm font-semibold"
              onClick={handleRetry}
              disabled={isLoading}
            >
              Retry
            </Button>
          </EmptyContent>
        </Empty>
      );
    }

    if (!taskDetail) {
      return (
        <Empty className="mt-6">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Inbox className="h-6 w-6" />
            </EmptyMedia>
            <EmptyTitle>Task missing</EmptyTitle>
            <EmptyDescription>This task could not be found.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      );
    }

    return <TaskFilesTable files={taskFiles} />;
  }, [shouldShowLoadingState, shouldShowTauriState, error, isLoading, taskDetail, taskFiles]);

  return (
    <main className="min-h-[calc(100vh-9rem)] w-full bg-background px-4 py-10 text-foreground">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 rounded-3xl border border-border bg-card/95 px-6 py-8 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Task details
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">
              {taskDetail?.name ?? "Loading…"}
            </h1>
            {taskDetail && (
              <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
                <Badge variant="outline">{normalizeTaskStatus(taskDetail.status)}</Badge>
                <span>#{taskDetail.id}</span>
                <span>{taskDetail.fileCount.toLocaleString()} file(s)</span>
              </div>
            )}
          </div>
          <Button
            variant="outline"
            className="w-full rounded-2xl px-4 py-2 text-sm font-semibold sm:w-auto"
            asChild
          >
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>

        {content}
      </div>
    </main>
  );
}
