import { getDatabase } from "./database";

export interface SheetRecord {
  id: number;
  sheetPath: string;
  sheetFilePath: string | null;
  taskId: number | null;
}

interface SheetRow {
  id: number;
  sheet_path: string;
  sheet_file_path: string | null;
  task_id: number | null;
}

export interface TaskRecord {
  id: number;
  name: string;
  status: string;
  fileCount: number;
  createdAt: string;
  updatedAt: string;
}

interface TaskRow {
  id: number;
  name: string;
  status: string;
  file_count: number;
  created_at: string;
  updated_at: string;
  files_associated?: string | null;
}

interface FileRow {
  id: string;
  file_name: string;
  stored_path: string;
  mime_type: string | null;
}

export interface TaskDetail extends TaskRecord {
  fileIds: string[];
}

export interface StoredTaskFile {
  id: string;
  fileName: string;
  path: string;
  mimeType: string | null;
}

const requireInsertId = (result: { lastInsertId?: number }, entity: string) => {
  if (typeof result.lastInsertId !== "number") {
    throw new Error(`Unable to determine ${entity} id from SQLite response.`);
  }
  return result.lastInsertId;
};

export async function listSheets(): Promise<SheetRecord[]> {
  const db = await getDatabase();
  const rows = await db.select<SheetRow[]>(
    "SELECT id, sheet_path, sheet_file_path, task_id FROM sheets ORDER BY created_at DESC",
  );

  return rows.map((row) => ({
    id: row.id,
    sheetPath: row.sheet_path,
    sheetFilePath: row.sheet_file_path,
    taskId: row.task_id,
  }));
}

export async function createSheet(
  sheetPath: string,
  sheetFilePath: string | null = null,
): Promise<SheetRecord> {
  const db = await getDatabase();
  const result = await db.execute(
    "INSERT INTO sheets (sheet_path, sheet_file_path) VALUES (?1, ?2)",
    [sheetPath, sheetFilePath],
  );
  const id = requireInsertId(result, "sheet");
  return { id, sheetPath, sheetFilePath, taskId: null } as SheetRecord;
}

export async function attachSheetToTask(sheetId: number, taskId: number) {
  const db = await getDatabase();
  await db.execute("UPDATE sheets SET task_id = ?1 WHERE id = ?2", [taskId, sheetId]);
}

export interface TaskCreationInput {
  name: string;
  fileIds: string[];
  status?: string;
}

export async function createTaskRecord({
  name,
  fileIds,
  status = "Processing",
}: TaskCreationInput): Promise<number> {
  const db = await getDatabase();
  const serializedFiles = JSON.stringify(fileIds);
  const result = await db.execute(
    "INSERT INTO task (name, files_associated, file_count, status) VALUES (?1, ?2, ?3, ?4)",
    [name, serializedFiles, fileIds.length, status],
  );
  return requireInsertId(result, "task");
}

export async function listTasks(limit = 50): Promise<TaskRecord[]> {
  const db = await getDatabase();
  const rows = await db.select<TaskRow[]>(
    "SELECT id, name, file_count, status, created_at, updated_at FROM task ORDER BY updated_at DESC LIMIT ?1",
    [limit],
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
    fileCount: row.file_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

const parseFileIds = (serialized?: string | null) => {
  if (!serialized) {
    return [];
  }
  try {
    const parsed = JSON.parse(serialized);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
};

export async function getTaskDetail(taskId: number): Promise<TaskDetail | null> {
  const db = await getDatabase();
  const rows = await db.select<TaskRow[]>(
    "SELECT id, name, file_count, status, created_at, updated_at, files_associated FROM task WHERE id = ?1 LIMIT 1",
    [taskId],
  );
  if (!rows.length) {
    return null;
  }
  const row = rows[0];
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    fileCount: row.file_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    fileIds: parseFileIds(row.files_associated),
  };
}

export async function getStoredFilesByIds(ids: string[]): Promise<StoredTaskFile[]> {
  if (!ids.length) {
    return [];
  }
  const db = await getDatabase();
  const placeholders = ids.map((_, index) => `?${index + 1}`).join(", ");
  const rows = await db.select<FileRow[]>(
    `SELECT id, file_name, stored_path, mime_type FROM files WHERE id IN (${placeholders})`,
    ids,
  );
  return rows.map((row) => ({
    id: row.id,
    fileName: row.file_name,
    path: row.stored_path,
    mimeType: row.mime_type,
  }));
}

export async function getSheetByTaskId(taskId: number): Promise<SheetRecord | null> {
  const db = await getDatabase();
  const rows = await db.select<SheetRow[]>(
    "SELECT id, sheet_path, sheet_file_path, task_id FROM sheets WHERE task_id = ?1 ORDER BY updated_at DESC LIMIT 1",
    [taskId],
  );
  if (!rows.length) {
    return null;
  }
  const row = rows[0];
  return {
    id: row.id,
    sheetPath: row.sheet_path,
    sheetFilePath: row.sheet_file_path,
    taskId: row.task_id,
  };
}

export async function updateTaskStatus(taskId: number, status: string) {
  const db = await getDatabase();
  await db.execute("UPDATE task SET status = ?1 WHERE id = ?2", [status, taskId]);
}
