import { isTauriRuntime } from "./database";

const ACCOUNT_STORE_FILE = "account.preferences.json";
const GEMINI_KEY_PREF_KEY = "geminiApiKey";

export async function getGeminiApiKey(): Promise<string | null> {
  if (!isTauriRuntime()) {
    throw new Error("Gemini API key is stored locally. Launch the desktop shell to continue.");
  }

  const { Store } = await import("@tauri-apps/plugin-store");
  const store = await Store.load(ACCOUNT_STORE_FILE);
  const storedKey = await store.get<string>(GEMINI_KEY_PREF_KEY);
  const sanitized = storedKey?.trim();
  return sanitized && sanitized.length > 0 ? sanitized : null;
}
