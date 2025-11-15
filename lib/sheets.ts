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

export async function appendSheetRows(taskId: number, rows: SheetRowPayload[]) {
  if (!rows.length) {
    return;
  }
  if (!isTauriRuntime()) {
    throw new Error("Sheet updates are only available inside the desktop shell.");
  }

  await invoke("append_sheet_rows", {
    taskId,
    rows,
  });
}

export async function downloadSheetForTask(taskId: number): Promise<SheetDownloadResult> {
  if (!isTauriRuntime()) {
    throw new Error("Downloading sheets is only available inside the desktop shell.");
  }
  return invoke<SheetDownloadResult>("generate_sheet_xlsx", { task_id: taskId });
}
