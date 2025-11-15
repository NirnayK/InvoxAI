"use client";

import type { Store as AccountStore } from "@tauri-apps/plugin-store";
import { useEffect, useRef, useState } from "react";

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
import { CircleFadingArrowUpIcon, Eye, EyeOff } from "lucide-react";

const STORE_FILE_NAME = "account.preferences.json";
const GEMINI_KEY_PREF_KEY = "geminiApiKey";
const FILE_LOCATION_PREF_KEY = "fileStorageLocation";

type StatusVariant = "info" | "success" | "error";

type AnyWindow = Window &
  typeof globalThis & {
    __TAURI__?: unknown;
    __TAURI_IPC__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  };

function hasTauriRuntime() {
  if (typeof window === "undefined") {
    return false;
  }
  const win = window as AnyWindow;
  return Boolean(win.__TAURI_INTERNALS__ ?? win.__TAURI__ ?? win.__TAURI_IPC__);
}

function ButtonIcon() {
  return (
    <Button variant="ghost" size="icon" aria-label="Toggle preferences">
      <CircleFadingArrowUpIcon />
    </Button>
  );
}

export default function AccountPage() {
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [fileLocation, setFileLocation] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSelectingFolder, setIsSelectingFolder] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusVariant, setStatusVariant] = useState<StatusVariant>("info");
  const [defaultStatus, setDefaultStatus] = useState("Changes are saved locally for now.");
  const storeRef = useRef<AccountStore | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPreferences() {
      const runningInTauri = hasTauriRuntime();
      setDefaultStatus(
        runningInTauri
          ? "Preferences are stored securely on this device."
          : "Run the desktop shell to persist these settings between sessions.",
      );

      if (!runningInTauri) {
        return;
      }

      try {
        const { Store } = await import("@tauri-apps/plugin-store");
        const store = await Store.load(STORE_FILE_NAME);
        if (cancelled) {
          return;
        }

        storeRef.current = store;

        const [storedApiKey, storedPath] = await Promise.all([
          store.get<string>(GEMINI_KEY_PREF_KEY),
          store.get<string>(FILE_LOCATION_PREF_KEY),
        ]);

        if (cancelled) {
          return;
        }

        if (storedApiKey) {
          setGeminiApiKey(storedApiKey);
        }
        if (storedPath) {
          setFileLocation(storedPath);
        }
      } catch (error) {
        console.error("Failed to load saved account preferences", error);
        if (!cancelled) {
          setStatusVariant("error");
          setStatusMessage("Could not load saved preferences. Try saving again to recreate them.");
        }
      }
    }

    loadPreferences();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storeRef.current) {
      setStatusVariant("info");
      setStatusMessage("Preferences are only stored while this page is open.");
      return;
    }

    setIsSaving(true);
    try {
      const store = storeRef.current;
      const sanitizedKey = geminiApiKey.trim();
      const sanitizedPath = fileLocation.trim();

      if (sanitizedKey) {
        await store.set(GEMINI_KEY_PREF_KEY, sanitizedKey);
      } else {
        await store.delete(GEMINI_KEY_PREF_KEY);
      }

      if (sanitizedPath) {
        await store.set(FILE_LOCATION_PREF_KEY, sanitizedPath);
      } else {
        await store.delete(FILE_LOCATION_PREF_KEY);
      }

      await store.save();
      setStatusVariant("success");
      setStatusMessage("Account preferences updated.");
    } catch (error) {
      console.error("Failed to save account preferences", error);
      setStatusVariant("error");
      setStatusMessage("Unable to save preferences. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleChooseFileLocation() {
    if (!hasTauriRuntime()) {
      setStatusVariant("info");
      setStatusMessage("Folder picker is only available in the desktop shell.");
      return;
    }
    if (isSelectingFolder) {
      return;
    }

    setIsSelectingFolder(true);

    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selection = await open({
        directory: true,
        multiple: false,
        title: "Select a folder for storing Invox files",
        defaultPath: fileLocation || undefined,
      });

      if (!selection) {
        return;
      }

      const chosenPath = Array.isArray(selection) ? selection[0] : selection;
      if (typeof chosenPath === "string") {
        setFileLocation(chosenPath);
        setStatusMessage(null);
      }
    } catch (error) {
      console.error("Failed to select folder", error);
      setStatusVariant("error");
      setStatusMessage("Unable to open the folder picker. Enter the path manually.");
    } finally {
      setIsSelectingFolder(false);
    }
  }

  const statusClasses =
    statusVariant === "success"
      ? "text-emerald-600"
      : statusVariant === "error"
        ? "text-rose-600"
        : "text-muted-foreground";

  return (
    <main className="min-h-screen w-full bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-3xl px-2">
        <div className="rounded-3xl border border-border bg-card p-8 text-card-foreground shadow">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                Account
              </p>
              <h1 className="text-3xl font-semibold text-foreground">Workspace preferences</h1>
              <p className="text-sm text-muted-foreground">
                Manage the credentials and storage details used by automation tasks.
              </p>
            </div>
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
                  <div className="relative">
                    <Input
                      id="gemini-api-key"
                      type={showGeminiKey ? "text" : "password"}
                      value={geminiApiKey}
                      autoComplete="off"
                      onChange={(event) => setGeminiApiKey(event.target.value)}
                      placeholder="···············"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      aria-label={showGeminiKey ? "Hide Gemini API key" : "Show Gemini API key"}
                      onClick={() => setShowGeminiKey((prev) => !prev)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {showGeminiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
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
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="file-storage-location"
                      type="text"
                      autoComplete="off"
                      value={fileLocation}
                      onChange={(event) => setFileLocation(event.target.value)}
                      placeholder="s3://bucket/path or /workspace/data"
                      className="sm:flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0 sm:w-auto"
                      onClick={handleChooseFileLocation}
                      disabled={isSelectingFolder}
                    >
                      {isSelectingFolder ? "Selecting..." : "Choose folder"}
                    </Button>
                  </div>
                </Field>
              </FieldGroup>
            </FieldSet>

            <div className="flex items-center gap-4">
              <Button
                type="submit"
                variant="default"
                className="rounded-2xl border border-border px-6 py-3 text-sm font-semibold"
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save changes"}
              </Button>
              <p className={`text-sm ${statusMessage ? statusClasses : "text-muted-foreground"}`}>
                {statusMessage ?? defaultStatus}
              </p>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
