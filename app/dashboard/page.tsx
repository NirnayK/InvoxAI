"use client";

import { useState } from "react";
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
import { DataTable } from "@/components/files/data-table";
import { FileUploadModal } from "@/components/files/upload/file-upload-modal";
import { isTauriRuntime } from "@/lib/database";
import { useFiles } from "@/lib/hooks/use-files";

function FileList() {
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const { data, isLoading, isError, error, refetch } = useFiles({
    limit: 25,
    offset: 0,
    sortBy: "created_at",
    sortOrder: "DESC",
  });

  const files = data?.files ?? [];
  const hasFiles = files.length > 0;
  const isTauri = isTauriRuntime();

  let content: React.ReactNode = null;

  if (isLoading) {
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
  } else if (!isTauri) {
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
            onClick={() => refetch()}
          >
            Retry
          </Button>
        </EmptyContent>
      </Empty>
    );
  } else if (isError) {
    content = (
      <Empty className="mt-6">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Inbox className="h-6 w-6" />
          </EmptyMedia>
          <EmptyTitle>Unable to load files</EmptyTitle>
          <EmptyDescription>
            {error instanceof Error ? error.message : "Unknown error"}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            variant="outline"
            className="rounded-2xl px-5 py-2 text-sm font-semibold"
            onClick={() => refetch()}
          >
            Retry
          </Button>
        </EmptyContent>
      </Empty>
    );
  } else if (hasFiles) {
    content = <DataTable data={files} />;
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

        {content}
      </section>

      <FileUploadModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        onUploadComplete={() => refetch()}
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
