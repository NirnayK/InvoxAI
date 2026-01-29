import { isTauriRuntime, getDatabase } from "@/lib/database";
import { createLogger } from "@/lib/logger";
import type { GeminiModelRateLimit } from "@/lib/invoice/model-catalog";

const usageLogger = createLogger("GeminiModelUsage");

const usageLocks = new Map<string, Promise<void>>();

type UsageRow = {
  model: string;
  day: string;
  minute_window_start: number;
  requests_minute: number;
  requests_day: number;
};

const PACIFIC_TIMEZONE = "America/Los_Angeles";
const pacificFormatter =
  typeof Intl === "undefined"
    ? null
    : new Intl.DateTimeFormat("en-CA", {
        timeZone: PACIFIC_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });

const toPacificDayKey = (date: Date) => {
  if (!pacificFormatter) {
    return date.toISOString().slice(0, 10);
  }
  const parts = pacificFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    return date.toISOString().slice(0, 10);
  }
  return `${year}-${month}-${day}`;
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const withModelLock = async (model: string, task: () => Promise<void>) => {
  const current = usageLocks.get(model) ?? Promise.resolve();
  const next = current.then(task, task);
  usageLocks.set(
    model,
    next.finally(() => {
      if (usageLocks.get(model) === next) {
        usageLocks.delete(model);
      }
    }),
  );
  return next;
};

const loadUsageRow = async (model: string): Promise<UsageRow | null> => {
  const db = await getDatabase();
  const rows = await db.select<UsageRow[]>(
    "SELECT model, day, minute_window_start, requests_minute, requests_day FROM gemini_model_usage WHERE model = ?",
    [model],
  );
  return rows[0] ?? null;
};

const upsertUsageRow = async (row: UsageRow) => {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO gemini_model_usage
      (model, day, minute_window_start, requests_minute, requests_day)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(model) DO UPDATE SET
       day = excluded.day,
       minute_window_start = excluded.minute_window_start,
       requests_minute = excluded.requests_minute,
       requests_day = excluded.requests_day,
       updated_at = CURRENT_TIMESTAMP`,
    [
      row.model,
      row.day,
      row.minute_window_start,
      row.requests_minute,
      row.requests_day,
    ],
  );
};

export async function syncGeminiModelUsage(models: string[]): Promise<void> {
  if (!isTauriRuntime() || models.length === 0) {
    return;
  }

  const db = await getDatabase();
  const now = Date.now();
  const today = toPacificDayKey(new Date());

  try {
    for (const model of models) {
      await db.execute(
        `INSERT INTO gemini_model_usage
          (model, day, minute_window_start, requests_minute, requests_day)
         VALUES (?, ?, ?, 0, 0)
         ON CONFLICT(model) DO NOTHING`,
        [model, today, now],
      );
    }
  } catch (error) {
    usageLogger.warn("Failed to sync Gemini model usage records", { error });
  }
}

export async function claimGeminiModelRequest(
  model: string,
  limit?: GeminiModelRateLimit,
): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  const rpm = limit?.rpm ?? 0;
  const rpd = limit?.rpd ?? 0;

  if (rpm <= 0 && rpd <= 0) {
    await syncGeminiModelUsage([model]);
    return;
  }

  await withModelLock(model, async () => {
    const now = Date.now();
    const today = toPacificDayKey(new Date(now));

    let row = await loadUsageRow(model);
    if (!row) {
      row = {
        model,
        day: today,
        minute_window_start: now,
        requests_minute: 0,
        requests_day: 0,
      };
    }

    if (row.day !== today) {
      row.day = today;
      row.requests_day = 0;
    }

    if (now - row.minute_window_start >= 60_000) {
      row.minute_window_start = now;
      row.requests_minute = 0;
    }

    if (rpd > 0 && row.requests_day >= rpd) {
      throw new Error(
        `Gemini model ${model} exceeded daily rate limit (${rpd}). Reset the daily counter to continue.`,
      );
    }

    if (rpm > 0 && row.requests_minute >= rpm) {
      const waitMs = Math.max(0, 60_000 - (now - row.minute_window_start));
      if (waitMs > 0) {
        await sleep(waitMs);
      }
      const afterWait = Date.now();
      row.minute_window_start = afterWait;
      row.requests_minute = 0;
    }

    row.requests_minute += 1;
    row.requests_day += 1;

    try {
      await upsertUsageRow(row);
    } catch (error) {
      usageLogger.warn("Failed to update Gemini model usage counters", { error });
    }
  });
}
