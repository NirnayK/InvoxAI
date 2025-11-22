import { invoke } from "@tauri-apps/api/core";

import { isTauriRuntime } from "../database";

export interface XmlDownloadResponse {
  content: string;
  file_count: number;
}

export interface XmlFileRow {
  id: number;
  xmlName: string;
  createdAt: string;
  fileCount: number;
}

/**
 * Create a new XML export for a selection of files
 */
export async function createXmlForFiles(fileIds: string[], xmlName: string): Promise<number> {
  if (!isTauriRuntime()) {
    throw new Error("XML creation is only available inside the desktop shell.");
  }

  return invoke<number>("create_xml_for_files", { fileIds, xmlName });
}

/**
 * List existing XML files
 */
export async function listXmlFiles(): Promise<XmlFileRow[]> {
  if (!isTauriRuntime()) {
    return [];
  }
  return invoke<XmlFileRow[]>("list_xml_files");
}

/**
 * Append files to an existing XML export
 */
export async function appendXmlFile(xmlId: number, fileIds: string[]): Promise<void> {
  if (!isTauriRuntime()) {
    throw new Error("XML updates are only available inside the desktop shell.");
  }
  await invoke("append_xml_file", { xmlId, fileIds });
}

/**
 * Generate and download XML file
 */
export async function generateXmlFile(xmlId: number): Promise<XmlDownloadResponse> {
  if (!isTauriRuntime()) {
    throw new Error("Generating XML is only available inside the desktop shell.");
  }
  return invoke<XmlDownloadResponse>("generate_xml_file", { xmlId });
}
