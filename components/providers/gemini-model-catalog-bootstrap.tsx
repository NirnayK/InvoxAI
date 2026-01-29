"use client";

import { useEffect } from "react";

import { createLogger } from "@/lib/logger";
import { refreshGeminiModelCatalog } from "@/lib/invoice/model-catalog";

const bootstrapLogger = createLogger("GeminiModelCatalogBootstrap");

export function GeminiModelCatalogBootstrap() {
  useEffect(() => {
    let cancelled = false;

    refreshGeminiModelCatalog().catch((error) => {
      if (cancelled) {
        return;
      }
      bootstrapLogger.warn("Failed to refresh Gemini model catalog", { error });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
