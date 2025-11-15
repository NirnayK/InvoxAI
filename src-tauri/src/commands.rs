use crate::db::{get_connection, storage_dir};
use blake3;
use chrono::Utc;
use csv::{ReaderBuilder, WriterBuilder};
use dirs;
use rusqlite::{params, Connection, OptionalExtension, Row};
use rust_xlsxwriter::Workbook;
use serde::{Deserialize, Serialize};
use serde_json;
use std::collections::HashSet;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use uuid::Uuid;

#[derive(Serialize)]
pub struct FileRow {
    pub id: String,
    pub file_name: String,
    pub hash: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageStats {
    pub path: String,
    pub total_bytes: u64,
    pub file_count: u64,
}

#[derive(Debug)]
struct TaskFiles {
    id: i64,
    status: String,
    files: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SheetRowInput {
    pub file_id: Option<String>,
    pub file_name: Option<String>,
    pub seller_name: Option<String>,
    pub invoice_number: Option<String>,
    pub invoice_date: Option<String>,
    pub seller_address: Option<String>,
    pub items_json: Option<String>,
    pub raw_payload: String,
}

#[derive(Serialize, Deserialize, Clone)]
struct SheetCsvRow {
    task_id: i64,
    file_id: Option<String>,
    file_name: Option<String>,
    seller_name: Option<String>,
    invoice_number: Option<String>,
    invoice_date: Option<String>,
    seller_address: Option<String>,
    items_json: Option<String>,
    raw_payload: String,
}

impl SheetCsvRow {
    fn headers() -> [&'static str; 9] {
        [
            "task_id",
            "file_id",
            "file_name",
            "seller_name",
            "invoice_number",
            "invoice_date",
            "seller_address",
            "items_json",
            "raw_payload",
        ]
    }
}

struct SheetMeta {
    id: i64,
    sheet_path: String,
    sheet_file_path: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SheetDownloadResponse {
    pub path: String,
    pub rows: usize,
}

fn file_row_from_row(row: &Row) -> rusqlite::Result<FileRow> {
    Ok(FileRow {
        id: row.get(0)?,
        file_name: row.get(1)?,
        hash: row.get(2)?,
    })
}

fn persist_buffer(file_name: &str, buffer: &[u8]) -> Result<String, String> {
    let hash = blake3::hash(buffer);
    let hash_hex = hash.to_hex().to_string();

    let conn = get_connection().map_err(|error| error.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id FROM files WHERE hash_sha256 = ?1 LIMIT 1")
        .map_err(|error| error.to_string())?;

    let existing: Result<String, _> = stmt.query_row(params![hash_hex.clone()], |row| row.get(0));

    if let Ok(existing_id) = existing {
        return Ok(format!("DUPLICATE:{}", existing_id));
    }

    let id = Uuid::new_v4().to_string();
    let storage = storage_dir().map_err(|error| error.to_string())?;
    let original_path = Path::new(file_name);

    let ext = original_path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("");

    let stored_path = if ext.is_empty() {
        storage.join(&id)
    } else {
        storage.join(format!("{}.{}", &id, ext))
    };

    fs::write(&stored_path, buffer).map_err(|error| error.to_string())?;

    conn.execute(
        "INSERT INTO files (id, hash_sha256, file_name, stored_path, size_bytes, parsed_details)
         VALUES (?1, ?2, ?3, ?4, ?5, NULL)",
        params![
            id,
            hash_hex,
            file_name,
            stored_path.to_string_lossy().to_string(),
            buffer.len() as i64
        ],
    )
    .map_err(|error| error.to_string())?;

    Ok(format!("OK:{}", id))
}

fn ensure_sheet_data_dir() -> Result<PathBuf, String> {
    let mut dir = storage_dir().map_err(|error| error.to_string())?;
    dir.push("sheets");
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir)
}

fn load_sheet_metadata(conn: &Connection, task_id: i64) -> Result<SheetMeta, String> {
    let mut stmt = conn
        .prepare("SELECT id, sheet_path, sheet_file_path FROM sheets WHERE task_id = ?1 LIMIT 1")
        .map_err(|error| error.to_string())?;
    let sheet = stmt
        .query_row(params![task_id], |row| {
            Ok(SheetMeta {
                id: row.get(0)?,
                sheet_path: row.get(1)?,
                sheet_file_path: row.get(2)?,
            })
        })
        .optional()
        .map_err(|error| error.to_string())?;

    sheet.ok_or_else(|| {
        "This task is not linked to a sheet. Assign a sheet before processing it.".to_string()
    })
}

fn read_sheet_csv(path: &Path) -> Result<Vec<SheetCsvRow>, String> {
    if !path.exists() {
        return Ok(Vec::new());
    }

    let mut reader = ReaderBuilder::new()
        .has_headers(true)
        .from_path(path)
        .map_err(|error| error.to_string())?;

    let mut rows = Vec::new();
    for record in reader.deserialize() {
        let row: SheetCsvRow = record.map_err(|error| error.to_string())?;
        rows.push(row);
    }

    Ok(rows)
}

fn write_sheet_csv(path: &Path, rows: &[SheetCsvRow]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let mut writer = WriterBuilder::new()
        .has_headers(false)
        .from_path(path)
        .map_err(|error| error.to_string())?;

    writer
        .write_record(SheetCsvRow::headers())
        .map_err(|error| error.to_string())?;

    for row in rows {
        writer.serialize(row).map_err(|error| error.to_string())?;
    }

    writer.flush().map_err(|error| error.to_string())
}

fn sanitize_file_name(value: &str, fallback: &str) -> String {
    let mut result = String::with_capacity(value.len());
    let mut last_dash = false;

    for ch in value.chars() {
        if ch.is_ascii_alphanumeric() {
            result.push(ch.to_ascii_lowercase());
            last_dash = false;
        } else if ch.is_ascii_whitespace() || "-_.".contains(ch) {
            if !last_dash {
                result.push('-');
                last_dash = true;
            }
        }
    }

    let trimmed = result.trim_matches('-').to_string();
    if trimmed.is_empty() {
        fallback.to_string()
    } else {
        trimmed
    }
}

fn compute_storage_stats() -> Result<StorageStats, String> {
    let dir = storage_dir().map_err(|error| error.to_string())?;
    let mut total_bytes: u64 = 0;
    let mut file_count: u64 = 0;

    if dir.exists() {
        for entry in fs::read_dir(&dir).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            let metadata = entry.metadata().map_err(|error| error.to_string())?;
            if metadata.is_file() {
                total_bytes += metadata.len();
                file_count += 1;
            }
        }
    }

    Ok(StorageStats {
        path: dir.to_string_lossy().into_owned(),
        total_bytes,
        file_count,
    })
}

fn load_task_files() -> Result<Vec<TaskFiles>, String> {
    let conn = get_connection().map_err(|error| error.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, status, files_associated FROM task")
        .map_err(|error| error.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let files_json: String = row.get(2)?;
            let parsed: Vec<String> = serde_json::from_str(&files_json).unwrap_or_default();
            Ok(TaskFiles {
                id: row.get(0)?,
                status: row.get(1)?,
                files: parsed,
            })
        })
        .map_err(|error| error.to_string())?;

    let mut tasks = Vec::new();
    for row in rows {
        tasks.push(row.map_err(|error| error.to_string())?);
    }
    Ok(tasks)
}

fn delete_files_by_ids(ids: &HashSet<String>) -> Result<(), String> {
    if ids.is_empty() {
        return Ok(());
    }

    let conn = get_connection().map_err(|error| error.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, stored_path FROM files")
        .map_err(|error| error.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let id: String = row.get(0)?;
            let path: String = row.get(1)?;
            Ok((id, path))
        })
        .map_err(|error| error.to_string())?;

    let mut targets = Vec::new();
    for row in rows {
        let (id, path) = row.map_err(|error| error.to_string())?;
        if ids.contains(&id) {
            targets.push((id, path));
        }
    }

    for (id, path) in targets {
        let file_path = Path::new(&path);
        if file_path.exists() {
            fs::remove_file(file_path).map_err(|error| error.to_string())?;
        }
        conn.execute("DELETE FROM files WHERE id = ?1", params![id])
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn append_sheet_rows(task_id: i64, rows: Vec<SheetRowInput>) -> Result<String, String> {
    if rows.is_empty() {
        return Ok(String::new());
    }

    let conn = get_connection().map_err(|error| error.to_string())?;
    let sheet = load_sheet_metadata(&conn, task_id)?;

    let csv_path = if let Some(existing) = sheet.sheet_file_path {
        PathBuf::from(existing)
    } else {
        let dir = ensure_sheet_data_dir()?;
        let fallback = format!("sheet-{}", sheet.id);
        dir.join(format!(
            "{}.csv",
            sanitize_file_name(&sheet.sheet_path, &fallback)
        ))
    };

    let mut existing_rows = read_sheet_csv(&csv_path)?;
    let dedupe_ids: HashSet<String> = rows.iter().filter_map(|row| row.file_id.clone()).collect();

    if !dedupe_ids.is_empty() {
        existing_rows.retain(|row| match &row.file_id {
            Some(id) => !dedupe_ids.contains(id),
            None => true,
        });
    }

    for row in rows {
        existing_rows.push(SheetCsvRow {
            task_id,
            file_id: row.file_id,
            file_name: row.file_name,
            seller_name: row.seller_name,
            invoice_number: row.invoice_number,
            invoice_date: row.invoice_date,
            seller_address: row.seller_address,
            items_json: row.items_json,
            raw_payload: row.raw_payload,
        });
    }

    write_sheet_csv(&csv_path, &existing_rows)?;

    conn.execute(
        "UPDATE sheets SET sheet_file_path = ?1 WHERE id = ?2",
        params![csv_path.to_string_lossy().to_string(), sheet.id],
    )
    .map_err(|error| error.to_string())?;

    Ok(csv_path.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn generate_sheet_xlsx(task_id: i64) -> Result<SheetDownloadResponse, String> {
    let conn = get_connection().map_err(|error| error.to_string())?;
    let sheet = load_sheet_metadata(&conn, task_id)?;
    let csv_path_str = sheet.sheet_file_path.ok_or_else(|| {
        "This sheet does not have any stored data yet. Run the task before downloading.".to_string()
    })?;

    let csv_path = PathBuf::from(&csv_path_str);
    if !csv_path.exists() {
        return Err(
            "The stored sheet data could not be located. Try running the task again.".to_string(),
        );
    }

    let rows = read_sheet_csv(&csv_path)?;
    if rows.is_empty() {
        return Err("No rows found for this sheet.".to_string());
    }

    let download_dir = dirs::download_dir()
        .ok_or_else(|| "Unable to locate the Downloads directory on this device.".to_string())?;
    fs::create_dir_all(&download_dir).map_err(|error| error.to_string())?;

    let fallback = format!("sheet-{}", sheet.id);
    let file_name = format!("{}.xlsx", sanitize_file_name(&sheet.sheet_path, &fallback));
    let xlsx_path = download_dir.join(file_name);

    let mut workbook = Workbook::new();
    let worksheet = workbook.add_worksheet();
    let headers = [
        "Task ID",
        "File ID",
        "File Name",
        "Seller Name",
        "Invoice Number",
        "Invoice Date",
        "Seller Address",
        "Items (JSON)",
        "Raw Payload",
    ];

    for (col, header) in headers.iter().enumerate() {
        worksheet
            .write_string(0, col as u16, *header)
            .map_err(|error| error.to_string())?;
    }

    for (index, row) in rows.iter().enumerate() {
        let excel_row = (index + 1) as u32;
        worksheet
            .write_string(excel_row, 0, &row.task_id.to_string())
            .map_err(|error| error.to_string())?;
        worksheet
            .write_string(excel_row, 1, row.file_id.as_deref().unwrap_or(""))
            .map_err(|error| error.to_string())?;
        worksheet
            .write_string(excel_row, 2, row.file_name.as_deref().unwrap_or(""))
            .map_err(|error| error.to_string())?;
        worksheet
            .write_string(excel_row, 3, row.seller_name.as_deref().unwrap_or(""))
            .map_err(|error| error.to_string())?;
        worksheet
            .write_string(excel_row, 4, row.invoice_number.as_deref().unwrap_or(""))
            .map_err(|error| error.to_string())?;
        worksheet
            .write_string(excel_row, 5, row.invoice_date.as_deref().unwrap_or(""))
            .map_err(|error| error.to_string())?;
        worksheet
            .write_string(excel_row, 6, row.seller_address.as_deref().unwrap_or(""))
            .map_err(|error| error.to_string())?;
        worksheet
            .write_string(excel_row, 7, row.items_json.as_deref().unwrap_or(""))
            .map_err(|error| error.to_string())?;
        worksheet
            .write_string(excel_row, 8, row.raw_payload.as_str())
            .map_err(|error| error.to_string())?;
    }

    workbook
        .save(&xlsx_path)
        .map_err(|error| error.to_string())?;

    Ok(SheetDownloadResponse {
        path: xlsx_path.to_string_lossy().into_owned(),
        rows: rows.len(),
    })
}

#[tauri::command]
pub fn import_file(path: String) -> Result<String, String> {
    let mut file = fs::File::open(&path).map_err(|error| error.to_string())?;
    let mut buf = Vec::new();
    file.read_to_end(&mut buf)
        .map_err(|error| error.to_string())?;

    let original_path = Path::new(&path);
    let file_name = original_path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("file");

    persist_buffer(file_name, &buf)
}

#[tauri::command]
pub fn import_data(file_name: String, bytes: Vec<u8>) -> Result<String, String> {
    persist_buffer(&file_name, &bytes)
}

#[tauri::command]
pub fn list_files() -> Result<Vec<FileRow>, String> {
    let conn = get_connection().map_err(|error| error.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id, file_name, hash_sha256 FROM files ORDER BY created_at DESC LIMIT 50")
        .map_err(|error| error.to_string())?;

    let rows_iter = stmt
        .query_map([], |row| file_row_from_row(row))
        .map_err(|error| error.to_string())?;

    let mut rows = Vec::new();
    for row in rows_iter {
        rows.push(row.map_err(|error| error.to_string())?);
    }
    Ok(rows)
}

#[tauri::command]
pub fn get_storage_stats() -> Result<StorageStats, String> {
    compute_storage_stats()
}

#[tauri::command]
pub fn clear_processed_files() -> Result<StorageStats, String> {
    let tasks = load_task_files()?;
    if tasks.is_empty() {
        return compute_storage_stats();
    }

    let mut completed_files: HashSet<String> = HashSet::new();
    let mut active_files: HashSet<String> = HashSet::new();

    for task in &tasks {
        let is_completed = task.status.eq_ignore_ascii_case("completed");
        for file_id in &task.files {
            if is_completed {
                completed_files.insert(file_id.clone());
            } else {
                active_files.insert(file_id.clone());
            }
        }
    }

    completed_files.retain(|id| !active_files.contains(id));

    delete_files_by_ids(&completed_files)?;

    let conn = get_connection().map_err(|error| error.to_string())?;
    for task in tasks
        .into_iter()
        .filter(|task| task.status.eq_ignore_ascii_case("completed"))
    {
        let TaskFiles { id, files, .. } = task;
        if files.is_empty() {
            continue;
        }
        let original_len = files.len();
        let remaining: Vec<String> = files
            .into_iter()
            .filter(|file_id| !completed_files.contains(file_id))
            .collect();
        if remaining.len() == original_len {
            continue;
        }

        let serialized = serde_json::to_string(&remaining).map_err(|error| error.to_string())?;
        conn.execute(
            "UPDATE task SET files_associated = ?1, file_count = ?2 WHERE id = ?3",
            params![serialized, remaining.len() as i64, id],
        )
        .map_err(|error| error.to_string())?;
    }

    compute_storage_stats()
}

fn log_file_path() -> Result<PathBuf, String> {
    let storage = storage_dir().map_err(|error| error.to_string())?;
    let app_dir = storage
        .parent()
        .map(|parent| parent.to_path_buf())
        .ok_or_else(|| "Unable to determine application directory for logging.".to_string())?;

    let log_dir = app_dir.join("logs");
    fs::create_dir_all(&log_dir).map_err(|error| error.to_string())?;

    Ok(log_dir.join("invox.log"))
}

fn sanitize_log_value(value: &str) -> String {
    value.replace('\n', "\\n").replace('\r', "\\r")
}

#[tauri::command]
pub fn append_log_entry(
    level: &str,
    message: &str,
    context: Option<String>,
    metadata: Option<String>,
) -> Result<(), String> {
    let path = log_file_path()?;
    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|error| error.to_string())?;

    let timestamp = Utc::now().to_rfc3339();
    let level_upper = level.to_uppercase();

    let mut line = format!("{timestamp} [{level_upper}]");
    if let Some(context) = context {
        line.push(' ');
        line.push('(');
        line.push_str(&sanitize_log_value(&context));
        line.push(')');
    }
    line.push(' ');
    line.push_str(&sanitize_log_value(message));

    if let Some(metadata) = metadata {
        let sanitized_metadata = sanitize_log_value(&metadata);
        if !sanitized_metadata.is_empty() {
            line.push_str(" :: ");
            line.push_str(&sanitized_metadata);
        }
    }

    writeln!(file, "{line}").map_err(|error| error.to_string())?;
    Ok(())
}
