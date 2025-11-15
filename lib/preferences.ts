import { isTauriRuntime } from "./database";

const ACCOUNT_STORE_FILE = "account.preferences.json";
const GEMINI_KEY_PREF_KEY = "geminiApiKey";

const sanitizeKey = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
};

const getEnvGeminiApiKey = () => {
  if (typeof process === "undefined" || !process.env) {
    return undefined;
  }
  return process.env.NEXT_PUBLIC_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;
};

export async function getGeminiApiKey(): Promise<string | null> {
  if (!isTauriRuntime()) {
    throw new Error("Gemini API key is stored locally. Launch the desktop shell to continue.");
  }

  const { Store } = await import("@tauri-apps/plugin-store");
  const store = await Store.load(ACCOUNT_STORE_FILE);
  const storedKey = await store.get<string>(GEMINI_KEY_PREF_KEY);
  const sanitizedStoredKey = sanitizeKey(storedKey);
  if (sanitizedStoredKey) {
    return sanitizedStoredKey;
  }

  return sanitizeKey(getEnvGeminiApiKey());
}
