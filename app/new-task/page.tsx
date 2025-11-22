"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { FileUpload } from "@/components/files/file-upload";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { importFiles } from "@/lib/file-import";
import { isTauriRuntime } from "@/lib/database";
import { createLogger } from "@/lib/logger";
import {
  attachSheetToTask,
  createSheet,
  createTaskRecord,
  listSheets,
  type SheetRecord,
} from "@/lib/tasks";

const MAX_FILES = 10;
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const NEW_SHEET_VALUE = "new-sheet";

type StatusVariant = "info" | "success" | "error";

interface StatusState {
  variant: StatusVariant;
  message: string;
}

const formatDayWithSuffix = (day: number) => {
  if (day >= 11 && day <= 13) {
    return `${day}th`;
  }
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
};

const formatSheetLabel = (date = new Date()) => {
  const monthName = date.toLocaleString("en-US", { month: "long" });
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const hours24 = date.getHours();
  const hours12 = hours24 % 12 || 12;
  const meridiem = hours24 >= 12 ? "PM" : "AM";
  return `${formatDayWithSuffix(date.getDate())} ${monthName}, ${hours12}.${minutes} ${meridiem}`;
};

const newTaskLogger = createLogger("NewTaskPage");

export default function NewTaskPage() {
  const [taskName, setTaskName] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadResetKey, setUploadResetKey] = useState(0);
  const [sheets, setSheets] = useState<SheetRecord[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>(NEW_SHEET_VALUE);
  const [status, setStatus] = useState<StatusState | null>(null);
  const [tauriReady, setTauriReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const available = isTauriRuntime();
    setTauriReady(available);

    if (!available) {
      setStatus({
        variant: "info",
        message: "Task creation requires running the Invox desktop shell.",
      });
      return;
    }

    let cancelled = false;
    setIsLoadingSheets(true);

    listSheets()
      .then((existing) => {
        if (cancelled) {
          return;
        }
        setSheets(existing);
      })
      .catch((error) => {
        newTaskLogger.error("Failed to load sheets", { error });
        if (!cancelled) {
          setStatus({ variant: "error", message: "Unable to load existing sheets." });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingSheets(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreateNewSheet = useCallback(async () => {
    if (!tauriReady) {
      setStatus({ variant: "info", message: "Start the desktop shell to create sheets." });
      return null;
    }
    if (isCreatingSheet) {
      return null;
    }

    setIsCreatingSheet(true);
    const label = formatSheetLabel();
    try {
      const created = await createSheet(label);
      setSheets((previous) => [created, ...previous]);
      setSelectedSheet(String(created.id));
      setStatus({ variant: "success", message: `Created sheet "${label}".` });
      return created;
    } catch (error) {
      newTaskLogger.error("Failed to create sheet", { error });
      setStatus({ variant: "error", message: "Unable to create a new sheet. Please try again." });
      return null;
    } finally {
      setIsCreatingSheet(false);
    }
  }, [tauriReady, isCreatingSheet]);

  const handleSheetChange = (value: string) => {
    setSelectedSheet(value);
  };

  const ensureSheetId = useCallback(async () => {
    if (selectedSheet !== NEW_SHEET_VALUE) {
      return Number(selectedSheet);
    }
    const created = await handleCreateNewSheet();
    if (!created) {
      throw new Error("Sheet creation failed. Please try again.");
    }
    return created.id;
  }, [handleCreateNewSheet, selectedSheet]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!tauriReady) {
      setStatus({ variant: "info", message: "Run the desktop shell to save tasks." });
      return;
    }

    const sanitizedName = taskName.trim();
    if (!sanitizedName) {
      setStatus({ variant: "error", message: "Enter a task name before saving." });
      return;
    }

    setIsSaving(true);
    setStatus(null);

    try {
      const sheetId = await ensureSheetId();
      const importedFiles = await importFiles(pendingFiles);
      const uniqueFileIds = Array.from(new Set(importedFiles.map((file) => file.id)));
      const duplicateCount = importedFiles.filter((file) => file.duplicate).length;

      const taskId = await createTaskRecord({ name: sanitizedName, fileIds: uniqueFileIds });
      if (sheetId) {
        await attachSheetToTask(sheetId, taskId);
      }

      setStatus({
        variant: "success",
        message:
          uniqueFileIds.length > 0
            ? `Saved "${sanitizedName}" with ${uniqueFileIds.length} file${
                uniqueFileIds.length === 1 ? "" : "s"
              }${duplicateCount ? ` (${duplicateCount} duplicate${duplicateCount === 1 ? "" : "s"} skipped)` : ""}.`
            : `Saved "${sanitizedName}" with no attachments.`,
      });

      setTaskName("");
      setPendingFiles([]);
      setUploadResetKey((value) => value + 1);
      setSelectedSheet(String(sheetId));
      router.push("/dashboard");
    } catch (error) {
      newTaskLogger.error("Failed to save task", { error });
      setStatus({
        variant: "error",
        message:
          error instanceof Error ? error.message : "Unable to save the task. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const alertVariant = status?.variant === "error" ? "destructive" : "default";

  return (
    <main className="min-h-[calc(100vh-9rem)] w-full bg-background text-foreground transition-colors px-4 py-10">
      <div className="mx-auto w-full max-w-5xl px-2">
        <div className="rounded-3xl border border-border bg-card/95 p-8 shadow transition-colors">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                Create task
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-foreground">New Task Details</h1>
            </div>
            <Button
              asChild
              variant="outline"
              className="w-full rounded-2xl px-4 py-2 text-center text-sm font-semibold transition sm:w-auto"
            >
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          </div>

          <form className="mt-10 space-y-8" onSubmit={handleSubmit}>
            <FieldSet>
              <FieldGroup className="space-y-0">
                <div className="flex flex-col gap-6">
                  <Field>
                    <FieldLabel htmlFor="task-name">Task name</FieldLabel>
                    <FieldDescription>Use a short, descriptive title.</FieldDescription>
                    <Input
                      id="task-name"
                      type="text"
                      autoComplete="off"
                      placeholder="Monthly reconciliation"
                      value={taskName}
                      onChange={(event) => setTaskName(event.target.value)}
                      disabled={isSaving}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="sheet">Sheet</FieldLabel>
                    <FieldDescription>
                      {isCreatingSheet
                        ? "Creating a new sheet..."
                        : "Pick an existing sheet or choose New sheet to auto-name one using the current date and time."}
                    </FieldDescription>
                    <Select
                      value={selectedSheet}
                      onValueChange={handleSheetChange}
                      disabled={!tauriReady || isSaving || isLoadingSheets || isCreatingSheet}
                    >
                      <SelectTrigger id="sheet" className="w-full justify-between">
                        <SelectValue placeholder="Choose or create a sheet" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NEW_SHEET_VALUE}>New sheet</SelectItem>
                        {sheets.map((sheet) => (
                          <SelectItem key={sheet.id} value={String(sheet.id)}>
                            {sheet.sheetPath}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </FieldGroup>
            </FieldSet>

            <FieldSet>
              <FieldLegend>Attachments</FieldLegend>
              <Field>
                <FileUpload
                  key={uploadResetKey}
                  maxFiles={MAX_FILES}
                  maxFileSize={MAX_FILE_SIZE}
                  onFilesChange={setPendingFiles}
                />
              </Field>
            </FieldSet>

            {status && (
              <Alert variant={alertVariant}>
                <AlertDescription>{status.message}</AlertDescription>
              </Alert>
            )}

            <Field orientation="horizontal" className="justify-end">
              <Button
                type="submit"
                variant="default"
                className="rounded-2xl px-6 py-3 text-sm font-semibold"
                disabled={isSaving || !tauriReady}
              >
                {isSaving ? "Saving..." : "Save task"}
              </Button>
            </Field>
          </form>
        </div>
      </div>
    </main>
  );
}
