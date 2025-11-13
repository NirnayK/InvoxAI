import Link from "next/link";

import { FileUpload } from "@/components/files/file-upload";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";

const MAX_FILES = 10;
const MAX_FILE_SIZE = 50 * 1024 * 1024;

export default function NewTaskPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-3xl space-y-8 rounded-3xl border border-slate-200 bg-white/90 p-8 shadow">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
              Create task
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">
              New Task details
            </h1>
          </div>
          <Link
            href="/dashboard"
            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Back to dashboard
          </Link>
        </div>

        <form className="space-y-10">
          <FieldSet>
            <FieldLegend>Task details</FieldLegend>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="task-name">Task name</FieldLabel>
                <FieldDescription>Give the task a descriptive title that surfaces in dashboards.</FieldDescription>
                <Input id="task-name" type="text" autoComplete="off" placeholder="Monthly reconciliation" />
              </Field>
              <Field>
                <FieldLabel htmlFor="detail">Description</FieldLabel>
                <FieldDescription>Share the files, steps, or expected outcomes for this task.</FieldDescription>
                <textarea
                  id="detail"
                  placeholder="Describe the files and actions for this task"
                  className="border-input text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 min-h-[7.5rem] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                />
              </Field>
            </FieldGroup>
          </FieldSet>

          <FieldSet>
            <FieldLegend>Workflow</FieldLegend>
            <FieldGroup>
              <div className="grid gap-6 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="source">Data source</FieldLabel>
                  <FieldDescription>Tell us where the documents or data for this task originate.</FieldDescription>
                  <select
                    id="source"
                    className="border-input text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 h-10 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  >
                    <option>Upload pack</option>
                    <option>API ingestion</option>
                    <option>Manual review</option>
                  </select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="priority">Priority</FieldLabel>
                  <FieldDescription>Determine where this work should sit in your processing queue.</FieldDescription>
                  <select
                    id="priority"
                    className="border-input text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 h-10 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  >
                    <option>Processing</option>
                    <option>Priority</option>
                    <option>Background</option>
                  </select>
                </Field>
              </div>
            </FieldGroup>
          </FieldSet>

          <FieldSet>
            <FieldLegend>Attachments</FieldLegend>
            <FieldGroup>
              <Field className="gap-4">
                <FieldContent>
                  <FieldLabel>Files</FieldLabel>
                  <FieldDescription>Drag and drop or click to upload supporting documents.</FieldDescription>
                </FieldContent>
                <FileUpload maxFiles={MAX_FILES} maxFileSize={MAX_FILE_SIZE} />
              </Field>
            </FieldGroup>
          </FieldSet>

          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-2xl border border-slate-900 bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Save task
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
