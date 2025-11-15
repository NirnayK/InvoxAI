"use client";

import type { Store as AccountStore } from "@tauri-apps/plugin-store";
import { useCallback, useEffect, useRef, useState } from "react";

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
import { clearStoredFiles, getStorageStats, type StorageStats } from "@/lib/storage";
import { Eye, EyeOff } from "lucide-react";

const STORE_FILE_NAME = "account.preferences.json";
const GEMINI_KEY_PREF_KEY = "geminiApiKey";

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

const formatBytes = (bytes: number) => {
  if (bytes === 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(1)} ${units[index]}`;
};

export default function AccountPage() {
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusVariant, setStatusVariant] = useState<StatusVariant>("info");
  const [defaultStatus, setDefaultStatus] = useState("Changes are saved locally for now.");
  const [tauriAvailable, setTauriAvailable] = useState(false);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [isLoadingStorage, setIsLoadingStorage] = useState(false);
  const [isClearingStorage, setIsClearingStorage] = useState(false);
  const storeRef = useRef<AccountStore | null>(null);

  const refreshStorageStats = useCallback(async () => {
    if (!hasTauriRuntime()) {
      setStorageStats(null);
      return;
    }
    setIsLoadingStorage(true);
    try {
      const stats = await getStorageStats();
      setStorageStats(stats);
    } catch (error) {
      console.error("Failed to load storage stats", error);
      setStatusVariant("error");
      setStatusMessage("Unable to load storage usage. Please try again.");
    } finally {
      setIsLoadingStorage(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPreferences() {
      const runningInTauri = hasTauriRuntime();
      setDefaultStatus(
        runningInTauri
          ? "Preferences are stored securely on this device."
          : "Run the desktop shell to persist these settings between sessions.",
      );
      setTauriAvailable(runningInTauri);

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

        const storedApiKey = await store.get<string>(GEMINI_KEY_PREF_KEY);

        if (!cancelled && storedApiKey) {
          setGeminiApiKey(storedApiKey);
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

  useEffect(() => {
    if (!tauriAvailable) {
      return;
    }
    refreshStorageStats();
  }, [tauriAvailable, refreshStorageStats]);

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

      if (sanitizedKey) {
        await store.set(GEMINI_KEY_PREF_KEY, sanitizedKey);
      } else {
        await store.delete(GEMINI_KEY_PREF_KEY);
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

  const handleFreeStorage = useCallback(async () => {
    if (!hasTauriRuntime()) {
      setStatusVariant("info");
      setStatusMessage("Storage management is only available in the desktop shell.");
      return;
    }
    if (isClearingStorage) {
      return;
    }

    setIsClearingStorage(true);
    try {
      const stats = await clearStoredFiles();
      setStorageStats(stats);
      setStatusVariant("success");
      setStatusMessage("Cleared processed files from local storage.");
    } catch (error) {
      console.error("Failed to clear stored files", error);
      setStatusVariant("error");
      setStatusMessage("Unable to free storage. Please try again.");
    } finally {
      setIsClearingStorage(false);
    }
  }, [isClearingStorage]);

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
                Manage the credentials used by automation tasks.
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
              </FieldGroup>
            </FieldSet>

            <FieldSet className="space-y-8">
              <FieldLegend>Storage</FieldLegend>
              <Field>
                <FieldLabel>Local storage usage</FieldLabel>
                <FieldDescription>
                  Files imported for processing are cached inside the Invox desktop data directory.
                  Only documents attached to completed tasks are eligible for cleanup.
                </FieldDescription>
                <div className="rounded-2xl border border-dashed border-border/70 bg-card/70 px-4 py-3 text-sm">
                  {tauriAvailable ? (
                    <>
                      <p className="font-mono text-xs text-muted-foreground break-all">
                        {storageStats?.path ?? "Calculating..."}
                      </p>
                      <p className="mt-2 text-muted-foreground">
                        {isLoadingStorage
                          ? "Calculating usage..."
                          : `${storageStats?.fileCount ?? 0} file${
                              (storageStats?.fileCount ?? 0) === 1 ? "" : "s"
                            } • ${formatBytes(storageStats?.totalBytes ?? 0)}`}
                      </p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">
                      Storage details are available when running the desktop shell.
                    </p>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleFreeStorage}
                    disabled={!tauriAvailable || isClearingStorage}
                  >
                    {isClearingStorage ? "Clearing..." : "Free storage"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={refreshStorageStats}
                    disabled={!tauriAvailable || isLoadingStorage || isClearingStorage}
                  >
                    {isLoadingStorage ? "Refreshing..." : "Refresh"}
                  </Button>
                </div>
              </Field>
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
