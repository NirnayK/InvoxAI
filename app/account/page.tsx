"use client";

import { useState } from "react";

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

export default function AccountPage() {
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [fileLocation, setFileLocation] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatusMessage("Account preferences updated.");
  }

  return (
    <main className="min-h-screen w-full bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-3xl px-2">
        <div className="rounded-3xl border border-border bg-card p-8 text-card-foreground shadow">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Account
            </p>
            <h1 className="text-3xl font-semibold text-foreground">Workspace preferences</h1>
            <p className="text-sm text-muted-foreground">
              Manage the credentials and storage details used by automation tasks.
            </p>
          </div>

          <form className="mt-10 space-y-8" onSubmit={handleSubmit}>
            <FieldSet className="space-y-8">
              <FieldLegend>Integrations</FieldLegend>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="gemini-api-key">Gemini API key</FieldLabel>
                  <FieldDescription>
                    The key used to authenticate with Google Gemini for generative tasks.
                  </FieldDescription>
                  <Input
                    id="gemini-api-key"
                    type="password"
                    value={geminiApiKey}
                    autoComplete="off"
                    onChange={(event) => setGeminiApiKey(event.target.value)}
                    placeholder="···············"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="file-storage-location">File storage location</FieldLabel>
                  <FieldDescription>
                    Enter the folder path on this computer that will be used to store and manage the
                    PDF or image file data for post-processing (for example,
                    <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">
                      /Users/me/Invox
                    </code>
                    or
                    <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">C:\data\invox</code>
                    ).
                  </FieldDescription>
                  <Input
                    id="file-storage-location"
                    type="text"
                    autoComplete="off"
                    value={fileLocation}
                    onChange={(event) => setFileLocation(event.target.value)}
                    placeholder="s3://bucket/path or /workspace/data"
                  />
                </Field>
              </FieldGroup>
            </FieldSet>

            <div className="flex items-center gap-4">
              <Button
                type="submit"
                variant="default"
                className="rounded-2xl border border-border px-6 py-3 text-sm font-semibold"
              >
                Save changes
              </Button>
              {statusMessage ? (
                <p className="text-sm font-medium text-emerald-600">{statusMessage}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Changes are saved locally for now.</p>
              )}
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
