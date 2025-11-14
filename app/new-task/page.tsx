import Link from "next/link";

import { FileUpload } from "@/components/files/file-upload";
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

const MAX_FILES = 10;
const MAX_FILE_SIZE = 50 * 1024 * 1024;

export default function NewTaskPage() {
  return (
    <main className="min-h-screen w-full bg-slate-50 px-4 py-10">
      <div className="mx-auto w-full max-w-5xl px-2">
        <div className="rounded-3xl border border-slate-200 bg-white/95 p-8 shadow">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
                Create task
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">New Task details</h1>
            </div>
            <Link
              href="/dashboard"
              className="w-full rounded-2xl border border-slate-300 px-4 py-2 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
            >
              Back to dashboard
            </Link>
          </div>

          <form className="mt-10 space-y-8">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
              <div className="space-y-10">
                <FieldSet>
                  <FieldLegend>Task details</FieldLegend>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="task-name">Task name</FieldLabel>
                      <FieldDescription>
                        Give the task a descriptive title that surfaces in dashboards.
                      </FieldDescription>
                      <Input
                        id="task-name"
                        type="text"
                        autoComplete="off"
                        placeholder="Monthly reconciliation"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="detail">Description</FieldLabel>
                      <FieldDescription>
                        Share the files, steps, or expected outcomes for this task.
                      </FieldDescription>
                      <textarea
                        id="detail"
                        placeholder="Describe the files and actions for this task"
                        className="border-input text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 min-h-[7.5rem] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                      />
                    </Field>
                  </FieldGroup>
                </FieldSet>
              </div>

              <div className="space-y-6 rounded-3xl border border-slate-200 bg-slate-50/70 p-6 shadow-sm">
                <FieldSet className="space-y-2">
                  <FieldLegend>Attachments</FieldLegend>
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-slate-900">Files</p>
                    <p className="text-sm text-slate-500">
                      Drag and drop or click to upload supporting documents.
                    </p>
                  </div>
                </FieldSet>

                <FileUpload maxFiles={MAX_FILES} maxFileSize={MAX_FILE_SIZE} />
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                variant="default"
                className="rounded-2xl border border-slate-900 bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Save task
              </Button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
