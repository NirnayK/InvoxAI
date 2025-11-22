import { invoke } from "@tauri-apps/api/core";

import { isTauriRuntime } from "./database";

export interface SheetRowPayload {
  fileId: string | null;
  fileName: string | null;
  sellerName: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  sellerAddress: string | null;
  itemsJson: string | null;
  rawPayload: string;
}

export interface SheetDownloadResult {
  path: string;
  rows: number;
}

/**
 * Create a new sheet for a selection of files
 */
export async function createSheetForFiles(fileIds: string[], sheetName: string): Promise<number> {
  if (!isTauriRuntime()) {
    throw new Error("Sheet creation is only available inside the desktop shell.");
  }

  return invoke<number>("create_sheet_for_files", { fileIds, sheetName });
}

/**
 * Append rows to a sheet
 */
export async function appendSheetRows(sheetId: number, rows: SheetRowPayload[]) {
  if (!rows.length) {
    return;
  }
  if (!isTauriRuntime()) {
    throw new Error("Sheet updates are only available inside the desktop shell.");
  }

  await invoke("append_sheet_rows", {
    sheetId,
    rows,
  });
}

/**
 * Download a sheet as XLSX file
 */
export async function downloadSheet(sheetId: number): Promise<SheetDownloadResult> {
  if (!isTauriRuntime()) {
    throw new Error("Downloading sheets is only available inside the desktop shell.");
  }
  return invoke<SheetDownloadResult>("generate_sheet_xlsx", { sheetId });
}
