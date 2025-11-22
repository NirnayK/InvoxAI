"use client";

import { useEffect, useState } from "react";
import { Upload, Inbox } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { FileTable } from "@/components/files/file-table";
import { FileUploadModal } from "@/components/files/file-upload-modal";
import { FileActions } from "@/components/files/file-actions";
import { isTauriRuntime } from "@/lib/database";
import { listFilesPaginated, type FileRecord } from "@/lib/files";
import { createLogger } from "@/lib/logger";

const dashboardLogger = createLogger("DashboardPage");

type StatusFilter = "All" | "Unprocessed" | "Processed" | "Failed";

function FileList() {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [runtimeChecked, setRuntimeChecked] = useState(false);
  const [tauriAvailable, setTauriAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadFiles = async () => {
      const available = isTauriRuntime();
      if (cancelled) {
        return;
      }

      setTauriAvailable(available);
      setRuntimeChecked(true);

      if (!available) {
        setFiles([]);
        setError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await listFilesPaginated({
          statusFilter: statusFilter === "All" ? undefined : statusFilter,
          limit: 50,
          offset: 0,
          sortBy: "created_at",
          sortOrder: "DESC",
        });

        if (!cancelled) {
          setFiles(result.files);
        }
      } catch (loadError) {
        dashboardLogger.error("Failed to load files", { error: loadError });
        if (!cancelled) {
          setFiles([]);
          setError("Unable to load files from the local database.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadFiles();

    return () => {
      cancelled = true;
    };
  }, [refreshIndex, statusFilter]);

  const handleRefresh = () => {
    setRefreshIndex((value) => value + 1);
    setSelectedFiles(new Set());
  };

  const handleUploadComplete = () => {
    handleRefresh();
  };

  const handleProcessComplete = () => {
    handleRefresh();
  };

  const selectedFileRecords = files.filter((f) => selectedFiles.has(f.id));

  const hasFiles = files.length > 0;
  const shouldShowLoadingState = (!runtimeChecked && !hasFiles) || (isLoading && !hasFiles);
  const shouldShowTauriState = runtimeChecked && !tauriAvailable;

  let content: React.ReactNode = null;

  if (shouldShowLoadingState) {
    content = (
      <Empty className="mt-6">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Inbox className="h-6 w-6" />
          </EmptyMedia>
          <EmptyTitle>Loading files</EmptyTitle>
          <EmptyDescription>Fetching files from the local database.</EmptyDescription>
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
            onClick={handleRefresh}
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
          <EmptyTitle>Unable to load files</EmptyTitle>
          <EmptyDescription>{error}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            variant="outline"
            className="rounded-2xl px-5 py-2 text-sm font-semibold"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            Retry
          </Button>
        </EmptyContent>
      </Empty>
    );
  } else if (hasFiles) {
    content = (
      <div className="space-y-4">
        <FileTable
          files={files}
          selectedFiles={selectedFiles}
          onSelectionChange={setSelectedFiles}
          onRefresh={handleRefresh}
        />
      </div>
    );
  } else {
    content = (
      <Empty className="mt-6">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Inbox className="h-6 w-6" />
          </EmptyMedia>
          <EmptyTitle>No files yet</EmptyTitle>
          <EmptyDescription>
            Upload invoice files to start processing them with AI.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="default" onClick={() => setUploadModalOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Upload Files
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <>
      <section className="w-full space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Invoice Files
            </p>
            <h2 className="text-3xl font-semibold text-foreground">Dashboard</h2>
          </div>
          <Button
            onClick={() => setUploadModalOpen(true)}
            className="gap-2 rounded-2xl px-5 py-2 text-sm font-semibold"
          >
            <Upload className="h-4 w-4" />
            Upload Files
          </Button>
        </div>

        {hasFiles && (
          <div className="flex items-center justify-between gap-4">
            <div className="flex gap-2">
              {(["All", "Unprocessed", "Processed", "Failed"] as StatusFilter[]).map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(status)}
                  className="text-xs"
                >
                  {status}
                </Button>
              ))}
            </div>

            {selectedFiles.size > 0 && (
              <FileActions
                selectedFiles={selectedFileRecords}
                onProcessComplete={handleProcessComplete}
              />
            )}
          </div>
        )}

        {content}
      </section>

      <FileUploadModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        onUploadComplete={handleUploadComplete}
      />
    </>
  );
}

export default function DashboardPage() {
  return (
    <main className="min-h-screen w-full bg-background">
      <div className="mx-auto flex min-h-screen max-w-7xl px-6 py-10">
        <FileList />
      </div>
    </main>
  );
}
