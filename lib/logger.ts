type LogLevel = "debug" | "info" | "warn" | "error";

export interface LoggerDetails {
  data?: unknown;
  error?: unknown;
}

type LoggerPayload = {
  level: LogLevel;
  message: string;
  context: string;
  metadata?: string;
};

type TauriCoreModule = typeof import("@tauri-apps/api/core");

const LOG_COMMAND = "append_log_entry";
const isClient = typeof window !== "undefined";

const hasTauriRuntime = () => {
  if (!isClient) {
    return false;
  }
  const win = window as Window & {
    __TAURI__?: unknown;
    __TAURI_IPC__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  };
  return Boolean(win.__TAURI_INTERNALS__ ?? win.__TAURI__ ?? win.__TAURI_IPC__);
};

const sanitizeError = (value: unknown) => {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  return value;
};

const buildMetadata = (details?: LoggerDetails) => {
  if (!details) {
    return undefined;
  }
  const metadata: Record<string, unknown> = {};

  if (details.data !== undefined) {
    metadata.data = details.data;
  }

  if (details.error !== undefined) {
    metadata.error = sanitizeError(details.error);
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
};

const safeStringify = (value: unknown) => {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const consoleAvailable = typeof console !== "undefined" ? console : null;

const logToConsole = (level: LogLevel, source: string, message: string, details?: LoggerDetails) => {
  if (!consoleAvailable) {
    return;
  }

  const args: unknown[] = [`[${source}] ${message}`];
  if (details?.error) {
    args.push(details.error);
  }
  if (details?.data) {
    args.push(details.data);
  }

  const method = (consoleAvailable as Record<string, (...values: unknown[]) => void>)[level];
  (method ?? consoleAvailable.log).apply(consoleAvailable, args);
};

let tauriModulePromise: Promise<TauriCoreModule> | null = null;

const getTauriModule = async () => {
  if (!tauriModulePromise) {
    tauriModulePromise = import("@tauri-apps/api/core");
  }
  return tauriModulePromise;
};

const persistLogEntry = async (payload: LoggerPayload) => {
  if (!hasTauriRuntime()) {
    return;
  }

  try {
    const tauri = await getTauriModule();
    await tauri.invoke(LOG_COMMAND, payload);
  } catch (error) {
    if (consoleAvailable) {
      (consoleAvailable.warn ?? consoleAvailable.log).call(
        consoleAvailable,
        "[Logger] Failed to persist log entry",
        error,
      );
    }
  }
};

export interface Logger {
  debug(message: string, details?: LoggerDetails): void;
  info(message: string, details?: LoggerDetails): void;
  warn(message: string, details?: LoggerDetails): void;
  error(message: string, details?: LoggerDetails): void;
}

export const createLogger = (source: string): Logger => {
  const send = (level: LogLevel, message: string, details?: LoggerDetails) => {
    logToConsole(level, source, message, details);
    const metadata = buildMetadata(details);
    const payload: LoggerPayload = {
      level,
      message,
      context: source,
      metadata: metadata ? safeStringify(metadata) : undefined,
    };
    void persistLogEntry(payload);
  };

  return {
    debug(message, details) {
      send("debug", message, details);
    },
    info(message, details) {
      send("info", message, details);
    },
    warn(message, details) {
      send("warn", message, details);
    },
    error(message, details) {
      send("error", message, details);
    },
  };
};
