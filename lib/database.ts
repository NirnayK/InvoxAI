const SQLITE_URL = "sqlite:app.db";

const isClient = () => typeof window !== "undefined";

export const isTauriRuntime = () => isClient() && Boolean(window.__TAURI_INTERNALS__);

async function loadSqlite() {
  const Database = (await import("@tauri-apps/plugin-sql")).default;
  return Database.load(SQLITE_URL);
}

type SqliteConnection = Awaited<ReturnType<typeof loadSqlite>>;

let connectionPromise: Promise<SqliteConnection> | null = null;

export async function getDatabase() {
  if (!isTauriRuntime()) {
    throw new Error("SQLite storage is only available inside the Tauri desktop runtime.");
  }

  if (!connectionPromise) {
    connectionPromise = loadSqlite();
  }

  return connectionPromise;
}
