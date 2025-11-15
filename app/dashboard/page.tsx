"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Inbox } from "lucide-react";

import { Task, TaskTable } from "@/components/tasks/task-table";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { isTauriRuntime } from "@/lib/database";
import { listTasks, normalizeTaskStatus, type TaskRecord } from "@/lib/tasks";
import { createLogger } from "@/lib/logger";

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const MONTH_MS = 30 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;

const formatAttachmentDetail = (count: number) => {
  if (count <= 0) {
    return "No attachments";
  }
  return `${count} file${count === 1 ? "" : "s"} attached`;
};

const parseTimestamp = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const hasTimezone = /([zZ]|[+-]\d\d:\d\d)$/.test(normalized);
  const candidate = hasTimezone ? normalized : `${normalized}Z`;
  const parsed = new Date(candidate);

  if (Number.isNaN(parsed.getTime())) {
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  return parsed;
};

const formatRelativeTimeFromTimestamp = (timestamp?: string | null) => {
  const date = parseTimestamp(timestamp);
  if (!date) {
    return "Unknown";
  }

  const diff = Date.now() - date.getTime();
  const absDiff = Math.abs(diff);
  const suffix = diff >= 0 ? "ago" : "from now";
  const format = (value: number, unit: string) =>
    `${value} ${unit}${value === 1 ? "" : "s"} ${suffix}`;

  if (absDiff < 5 * SECOND_MS) {
    return diff >= 0 ? "Just now" : "In a few seconds";
  }
  if (absDiff < MINUTE_MS) {
    return format(Math.round(absDiff / SECOND_MS), "second");
  }
  if (absDiff < HOUR_MS) {
    return format(Math.round(absDiff / MINUTE_MS), "minute");
  }
  if (absDiff < DAY_MS) {
    return format(Math.round(absDiff / HOUR_MS), "hour");
  }
  if (absDiff < WEEK_MS) {
    return format(Math.round(absDiff / DAY_MS), "day");
  }
  if (absDiff < MONTH_MS) {
    return format(Math.round(absDiff / WEEK_MS), "week");
  }
  if (absDiff < YEAR_MS) {
    return format(Math.round(absDiff / MONTH_MS), "month");
  }
  return format(Math.round(absDiff / YEAR_MS), "year");
};

const mapTaskRecord = (record: TaskRecord): Task => ({
  id: record.id,
  name: record.name,
  detail: formatAttachmentDetail(record.fileCount),
  files: record.fileCount.toLocaleString(),
  lastActivity: formatRelativeTimeFromTimestamp(record.updatedAt || record.createdAt),
  status: normalizeTaskStatus(record.status),
});

const dashboardLogger = createLogger("DashboardPage");

function TaskList() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [runtimeChecked, setRuntimeChecked] = useState(false);
  const [tauriAvailable, setTauriAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadTasks = async () => {
      const available = isTauriRuntime();
      if (cancelled) {
        return;
      }

      setTauriAvailable(available);
      setRuntimeChecked(true);

      if (!available) {
        setTasks([]);
        setError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const records = await listTasks();
        if (!cancelled) {
          setTasks(records.map(mapTaskRecord));
        }
      } catch (loadError) {
        dashboardLogger.error("Failed to load tasks", { error: loadError });
        if (!cancelled) {
          setTasks([]);
          setError("Unable to load tasks from the local database.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadTasks();

    return () => {
      cancelled = true;
    };
  }, [refreshIndex]);

  const hasTasks = tasks.length > 0;
  const shouldShowLoadingState = (!runtimeChecked && !hasTasks) || (isLoading && !hasTasks);
  const shouldShowTauriState = runtimeChecked && !tauriAvailable;
  const handleRetry = () => setRefreshIndex((value) => value + 1);

  let content: ReactNode = null;

  if (shouldShowLoadingState) {
    content = (
      <Empty className="mt-6">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Inbox className="h-6 w-6" />
          </EmptyMedia>
          <EmptyTitle>Loading tasks</EmptyTitle>
          <EmptyDescription>
            Fetching the latest queue from the local SQLite store.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  } else if (shouldShowTauriState) {
    content = (
      <Empty className="mt-6">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Inbox className="h-6 w-6" />
          </EmptyMedia>
          <EmptyTitle>Desktop runtime required</EmptyTitle>
          <EmptyDescription>
            Launch the Invox desktop shell (pnpm tauri:dev) to connect to the local database, then
            retry.
          </EmptyDescription>
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
  } else if (error) {
    content = (
      <Empty className="mt-6">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Inbox className="h-6 w-6" />
          </EmptyMedia>
          <EmptyTitle>Unable to load tasks</EmptyTitle>
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
  } else if (hasTasks) {
    content = <TaskTable tasks={tasks} onTaskUpdated={handleRetry} />;
  } else {
    content = (
      <Empty className="mt-6">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Inbox className="h-6 w-6" />
          </EmptyMedia>
          <EmptyTitle>No tasks yet</EmptyTitle>
          <EmptyDescription>
            You have not queued any processing jobs yet. Create your first task to start streaming
            documents through the pipeline.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="default" asChild>
            <Link href="/new-task">Create a task</Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <section className="w-full space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Live queue
          </p>
          <h2 className="text-3xl font-semibold text-foreground">Processing Tasks</h2>
        </div>
        <Link
          href="/new-task"
          className="rounded-2xl border border-border px-5 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
        >
          Create New Task
        </Link>
      </div>
      {content}
    </section>
  );
}

export default function DashboardPage() {
  return (
    <main className="min-h-screen w-full bg-background">
      <div className="mx-auto flex min-h-screen max-w-7xl px-6 py-10">
        <TaskList />
      </div>
    </main>
  );
}
