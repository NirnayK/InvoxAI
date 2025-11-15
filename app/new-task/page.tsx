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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MAX_FILES = 10;
const MAX_FILE_SIZE = 50 * 1024 * 1024;

export default function NewTaskPage() {
  return (
    <main className="min-h-screen w-full bg-background text-foreground transition-colors px-4 py-10">
      <div className="mx-auto w-full max-w-5xl px-2">
        <div className="rounded-3xl border border-border bg-card/95 p-8 shadow transition-colors">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                Create task
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-foreground">New Task details</h1>
            </div>
            <Button
              asChild
              variant="outline"
              className="w-full rounded-2xl px-4 py-2 text-center text-sm font-semibold transition sm:w-auto"
            >
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          </div>

          <form className="mt-10 space-y-8">
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
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="sheet">Sheet</FieldLabel>
                    <FieldDescription>Pick a sheet or keep the default.</FieldDescription>
                    <Select defaultValue="new-sheet">
                      <SelectTrigger id="sheet" className="w-full justify-between">
                        <SelectValue placeholder="New sheet" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new-sheet">New sheet</SelectItem>
                        <SelectItem value="monthly-reconciliation">
                          Monthly reconciliation
                        </SelectItem>
                        <SelectItem value="team-expenses">Team expenses</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </FieldGroup>
            </FieldSet>

            <FieldSet>
              <FieldLegend>Attachments</FieldLegend>
              <Field>
                <FileUpload maxFiles={MAX_FILES} maxFileSize={MAX_FILE_SIZE} />
              </Field>
            </FieldSet>

            <Field orientation="horizontal" className="justify-end">
              <Button
                type="submit"
                variant="default"
                className="rounded-2xl px-6 py-3 text-sm font-semibold"
              >
                Save task
              </Button>
            </Field>
          </form>
        </div>
      </div>
    </main>
  );
}
