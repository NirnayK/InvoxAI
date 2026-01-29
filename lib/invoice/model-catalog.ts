import { appDataDir, join } from "@tauri-apps/api/path";

import { isTauriRuntime } from "@/lib/database";
import { createDirectory, readFile, saveFile } from "@/lib/filesystem";
import { createLogger } from "@/lib/logger";
import { getGeminiModelCatalogUrl } from "@/lib/preferences";
import { syncGeminiModelUsage } from "@/lib/invoice/model-usage";

export type GeminiModelRateLimit = {
  rpm: number;
  rpd: number;
  concurrent: number;
};

export type GeminiModelCatalog = {
  defaultModel: string;
  models: string[];
  fallbackOrder: string[];
  rateLimits: Record<string, GeminiModelRateLimit>;
};

const GEMINI_MODEL_CATALOG_FILE = "gemini-models.json";

const DEFAULT_GEMINI_MODEL_CATALOG: GeminiModelCatalog = {
  defaultModel: "gemini-2.5-flash",
  models: [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
  ],
  fallbackOrder: [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
  ],
  rateLimits: {
    "gemini-2.5-flash": { rpm: 10, rpd: 1000, concurrent: 5 },
    "gemini-2.5-flash-lite": { rpm: 15, rpd: 1500, concurrent: 5 },
    "gemini-2.0-flash": { rpm: 15, rpd: 1500, concurrent: 5 },
    "gemini-2.0-flash-lite": { rpm: 30, rpd: 3000, concurrent: 10 },
    "gemini-2.5-pro": { rpm: 2, rpd: 100, concurrent: 1 },
  },
};

const catalogLogger = createLogger("GeminiModelCatalog");

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const toNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const dedupe = (items: string[]) => Array.from(new Set(items));

const normalizeCatalog = (raw: unknown): GeminiModelCatalog => {
  if (!raw || typeof raw !== "object") {
    return DEFAULT_GEMINI_MODEL_CATALOG;
  }

  const rawCatalog = raw as Record<string, unknown>;
  const rawModels = Array.isArray(rawCatalog.models)
    ? rawCatalog.models.filter(isNonEmptyString)
    : [];
  const rawFallbackOrder = Array.isArray(rawCatalog.fallbackOrder)
    ? rawCatalog.fallbackOrder.filter(isNonEmptyString)
    : [];

  const defaultModelCandidate = isNonEmptyString(rawCatalog.defaultModel)
    ? rawCatalog.defaultModel.trim()
    : undefined;

  const models = dedupe([...rawModels, ...rawFallbackOrder]);
  let fallbackOrder = rawFallbackOrder.length > 0 ? dedupe(rawFallbackOrder) : models.slice();
  const defaultModel =
    defaultModelCandidate ??
    fallbackOrder[0] ??
    models[0] ??
    DEFAULT_GEMINI_MODEL_CATALOG.defaultModel;

  if (!models.includes(defaultModel)) {
    models.unshift(defaultModel);
  }

  if (!fallbackOrder.includes(defaultModel)) {
    fallbackOrder.unshift(defaultModel);
  }

  if (fallbackOrder.length === 0) {
    fallbackOrder = models.slice();
  }

  const rateLimits: Record<string, GeminiModelRateLimit> = {
    ...DEFAULT_GEMINI_MODEL_CATALOG.rateLimits,
  };
  const rawRateLimits = rawCatalog.rateLimits;

  if (rawRateLimits && typeof rawRateLimits === "object") {
    for (const [model, limit] of Object.entries(rawRateLimits)) {
      if (!isNonEmptyString(model) || !limit || typeof limit !== "object") {
        continue;
      }
      const candidate = limit as Record<string, unknown>;
      const baseLimit = rateLimits[model] ?? { rpm: 0, rpd: 0, concurrent: 1 };
      const rpm = toNumber(candidate.rpm);
      const rpd = toNumber(candidate.rpd);
      const concurrent = toNumber(candidate.concurrent);
      rateLimits[model] = {
        rpm: rpm ?? baseLimit.rpm,
        rpd: rpd ?? baseLimit.rpd,
        concurrent: concurrent ?? baseLimit.concurrent,
      };
    }
  }

  return {
    defaultModel,
    models,
    fallbackOrder,
    rateLimits,
  };
};

const resolveCatalogPath = async () => {
  if (!isTauriRuntime()) {
    return null;
  }

  const dataDir = await appDataDir();
  await createDirectory(dataDir, true);
  return join(dataDir, GEMINI_MODEL_CATALOG_FILE);
};

const readCatalogFromDisk = async () => {
  const path = await resolveCatalogPath();
  if (!path) {
    return null;
  }

  try {
    const contents = await readFile(path);
    const parsed = JSON.parse(contents);
    return normalizeCatalog(parsed);
  } catch (error) {
    catalogLogger.warn("Failed to load Gemini model catalog from disk", { error });
    return null;
  }
};

const writeCatalogToDisk = async (catalog: GeminiModelCatalog) => {
  const path = await resolveCatalogPath();
  if (!path) {
    return;
  }

  try {
    await saveFile(path, JSON.stringify(catalog, null, 2), true);
  } catch (error) {
    catalogLogger.warn("Failed to persist Gemini model catalog", { error });
  }
};

let catalogCache: GeminiModelCatalog | null = null;
let loadPromise: Promise<GeminiModelCatalog> | null = null;

export const DEFAULT_MODEL = DEFAULT_GEMINI_MODEL_CATALOG.defaultModel;

export async function getGeminiModelCatalog(): Promise<GeminiModelCatalog> {
  if (catalogCache) {
    return catalogCache;
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    const diskCatalog = await readCatalogFromDisk();
    const resolved = diskCatalog ?? DEFAULT_GEMINI_MODEL_CATALOG;
    if (!catalogCache) {
      catalogCache = resolved;
      void syncGeminiModelUsage(resolved.models);
    }
    loadPromise = null;
    return catalogCache ?? resolved;
  })();

  return loadPromise;
}

export async function refreshGeminiModelCatalog(): Promise<GeminiModelCatalog> {
  let catalogUrl: string | null = null;
  try {
    catalogUrl = await getGeminiModelCatalogUrl();
  } catch (error) {
    catalogLogger.warn("Gemini model catalog URL is unavailable", { error });
  }

  if (!catalogUrl) {
    catalogLogger.warn("Gemini model catalog URL is not configured");
    return getGeminiModelCatalog();
  }

  try {
    const response = await fetch(catalogUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to fetch Gemini catalog (${response.status})`);
    }
    const rawText = await response.text();
    const parsed = JSON.parse(rawText);
    const normalized = normalizeCatalog(parsed);
    catalogCache = normalized;
    await writeCatalogToDisk(normalized);
    await syncGeminiModelUsage(normalized.models);
    return normalized;
  } catch (error) {
    catalogLogger.warn("Failed to refresh Gemini model catalog", { error });
    return getGeminiModelCatalog();
  }
}

export async function getGeminiDefaultModel(): Promise<string> {
  const catalog = await getGeminiModelCatalog();
  return catalog.defaultModel;
}

export async function getGeminiModelFallbackOrder(): Promise<string[]> {
  const catalog = await getGeminiModelCatalog();
  return catalog.fallbackOrder.length > 0 ? catalog.fallbackOrder : catalog.models.slice();
}

export async function getGeminiModelRateLimits(): Promise<
  Record<string, GeminiModelRateLimit>
> {
  const catalog = await getGeminiModelCatalog();
  return catalog.rateLimits;
}

export async function getGeminiModelOptions(): Promise<string[]> {
  const catalog = await getGeminiModelCatalog();
  return catalog.models.slice();
}
