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
pub struct FileRecord {
    pub id: String,
    pub file_name: String,
    pub stored_path: String,
    pub size_bytes: i64,
    pub mime_type: Option<String>,
    pub status: String,
    pub parsed_details: Option<String>,
    pub created_at: String,
    pub processed_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaginatedFilesResult {
    pub files: Vec<FileRecord>,
    pub total_count: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileListQuery {
    pub status_filter: Option<String>,
    pub search_query: Option<String>,
    pub limit: i64,
    pub offset: i64,
    pub sort_by: Option<String>,
    pub sort_order: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageStats {
    pub path: String,
    pub total_bytes: u64,
    pub file_count: u64,
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
    sheet_id: i64,
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
            "sheet_id",
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
    sheet_name: String,
    sheet_path: String,
    sheet_file_path: Option<String>,
    file_ids: Vec<String>,
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

fn load_sheet_metadata(conn: &Connection, sheet_id: i64) -> Result<SheetMeta, String> {
    let mut stmt = conn
        .prepare("SELECT id, sheet_name, sheet_path, sheet_file_path, file_ids FROM sheets WHERE id = ?1 LIMIT 1")
        .map_err(|error| error.to_string())?;
    let sheet = stmt
        .query_row(params![sheet_id], |row| {
            let file_ids_json: String = row.get(4)?;
            let file_ids: Vec<String> = serde_json::from_str(&file_ids_json).unwrap_or_default();
            Ok(SheetMeta {
                id: row.get(0)?,
                sheet_name: row.get(1)?,
                sheet_path: row.get(2)?,
                sheet_file_path: row.get(3)?,
                file_ids,
            })
        })
        .optional()
        .map_err(|error| error.to_string())?;

    sheet.ok_or_else(|| {
        "Sheet not found.".to_string()
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

#[tauri::command]
pub fn append_sheet_rows(sheet_id: i64, rows: Vec<SheetRowInput>) -> Result<String, String> {
    if rows.is_empty() {
        return Ok(String::new());
    }

    let conn = get_connection().map_err(|error| error.to_string())?;
    let sheet = load_sheet_metadata(&conn, sheet_id)?;

    let csv_path = if let Some(existing) = sheet.sheet_file_path {
        PathBuf::from(existing)
    } else {
        let dir = ensure_sheet_data_dir()?;
        let fallback = format!("sheet-{}", sheet.id);
        dir.join(format!(
            "{}.csv",
            sanitize_file_name(&sheet.sheet_name, &fallback)
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
            sheet_id,
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
pub fn generate_sheet_xlsx(sheet_id: i64) -> Result<SheetDownloadResponse, String> {
    let conn = get_connection().map_err(|error| error.to_string())?;
    let sheet = load_sheet_metadata(&conn, sheet_id)?;
    let csv_path_str = sheet.sheet_file_path.ok_or_else(|| {
        "This sheet does not have any stored data yet. Process files before downloading.".to_string()
    })?;

    let csv_path = PathBuf::from(&csv_path_str);
    if !csv_path.exists() {
        return Err(
            "The stored sheet data could not be located. Try processing files again.".to_string(),
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
    let file_name = format!("{}.xlsx", sanitize_file_name(&sheet.sheet_name, &fallback));
    let xlsx_path = download_dir.join(file_name);

    let mut workbook = Workbook::new();
    let worksheet = workbook.add_worksheet();
    let headers = [
        "Sheet ID",
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
            .write_string(excel_row, 0, &row.sheet_id.to_string())
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
pub fn list_files_paginated(query: FileListQuery) -> Result<PaginatedFilesResult, String> {
    let conn = get_connection().map_err(|error| error.to_string())?;
    
    // Build WHERE clause
    let mut where_clauses = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
    
    if let Some(status) = &query.status_filter {
        where_clauses.push("status = ?");
        params.push(Box::new(status.clone()));
    }
    
    if let Some(search) = &query.search_query {
        where_clauses.push("file_name LIKE ?");
        params.push(Box::new(format!("%{}%", search)));
    }
    
    let where_clause = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };
    
    // Get total count
    let count_query = format!("SELECT COUNT(*) FROM files {}", where_clause);
    let total_count: i64 = conn.query_row(
        &count_query,
        rusqlite::params_from_iter(params.iter().map(|p| p.as_ref())),
        |row| row.get(0)
    ).map_err(|error| error.to_string())?;
    
    // Build ORDER BY clause
    let sort_by = query.sort_by.as_deref().unwrap_or("created_at");
    let sort_order = query.sort_order.as_deref().unwrap_or("DESC");
    let order_clause = format!("ORDER BY {} {}", sort_by, sort_order);
    
    // Build main query
    let main_query = format!(
        "SELECT id, file_name, stored_path, size_bytes, mime_type, status, parsed_details, created_at, processed_at, updated_at FROM files {} {} LIMIT ? OFFSET ?",
        where_clause, order_clause
    );
    
    let mut stmt = conn.prepare(&main_query).map_err(|error| error.to_string())?;
    
    // Rebuild params for main query
    let mut main_params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
    if let Some(status) = &query.status_filter {
        main_params.push(Box::new(status.clone()));
    }
    if let Some(search) = &query.search_query {
        main_params.push(Box::new(format!("%{}%", search)));
    }
    main_params.push(Box::new(query.limit));
    main_params.push(Box::new(query.offset));
    
    let files_iter = stmt.query_map(
        rusqlite::params_from_iter(main_params.iter().map(|p| p.as_ref())),
        |row| {
            Ok(FileRecord {
                id: row.get(0)?,
                file_name: row.get(1)?,
                stored_path: row.get(2)?,
                size_bytes: row.get(3)?,
                mime_type: row.get(4)?,
                status: row.get(5)?,
                parsed_details: row.get(6)?,
                created_at: row.get(7)?,
                processed_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        }
    ).map_err(|error| error.to_string())?;
    
    let mut files = Vec::new();
    for file in files_iter {
        files.push(file.map_err(|error| error.to_string())?);
    }
    
    Ok(PaginatedFilesResult {
        files,
        total_count,
    })
}

#[tauri::command]
pub fn create_sheet_for_files(file_ids: Vec<String>, sheet_name: String) -> Result<i64, String> {
    let conn = get_connection().map_err(|error| error.to_string())?;
    
    let file_ids_json = serde_json::to_string(&file_ids).map_err(|error| error.to_string())?;
    let sheet_path = sanitize_file_name(&sheet_name, "untitled-sheet");
    
    conn.execute(
        "INSERT INTO sheets (sheet_name, file_ids, sheet_path) VALUES (?1, ?2, ?3)",
        params![sheet_name, file_ids_json, sheet_path],
    )
    .map_err(|error| error.to_string())?;
    
    let sheet_id = conn.last_insert_rowid();
    Ok(sheet_id)
}

#[tauri::command]
pub fn update_file_status(file_id: String, status: String) -> Result<(), String> {
    let conn = get_connection().map_err(|error| error.to_string())?;
    
    let processed_at = if status == "Processed" {
        Some(Utc::now().to_rfc3339())
    } else {
        None
    };
    
    conn.execute(
        "UPDATE files SET status = ?1, processed_at = ?2 WHERE id = ?3",
        params![status, processed_at, file_id],
    )
    .map_err(|error| error.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub fn update_files_status(file_ids: Vec<String>, status: String) -> Result<(), String> {
    if file_ids.is_empty() {
        return Ok(());
    }
    
    let conn = get_connection().map_err(|error| error.to_string())?;
    
    let processed_at = if status == "Processed" {
        Some(Utc::now().to_rfc3339())
    } else {
        None
    };
    
    let placeholders = file_ids.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
    let query = format!(
        "UPDATE files SET status = ?, processed_at = ? WHERE id IN ({})",
        placeholders
    );
    
    let mut stmt = conn.prepare(&query).map_err(|error| error.to_string())?;
    
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![
        Box::new(status),
        Box::new(processed_at),
    ];
    for id in file_ids {
        params.push(Box::new(id));
    }
    
    stmt.execute(rusqlite::params_from_iter(params.iter().map(|p| p.as_ref())))
        .map_err(|error| error.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub fn delete_files(file_ids: Vec<String>) -> Result<(), String> {
    if file_ids.is_empty() {
        return Ok(());
    }
    
    let conn = get_connection().map_err(|error| error.to_string())?;
    
    // Get file paths first
    let placeholders = file_ids.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
    let query = format!("SELECT id, stored_path FROM files WHERE id IN ({})", placeholders);
    
    let mut stmt = conn.prepare(&query).map_err(|error| error.to_string())?;
    let params: Vec<&dyn rusqlite::ToSql> = file_ids.iter().map(|id| id as &dyn rusqlite::ToSql).collect();
    
    let files_iter = stmt.query_map(params.as_slice(), |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    }).map_err(|error| error.to_string())?;
    
    let mut files_to_delete = Vec::new();
    for file in files_iter {
        files_to_delete.push(file.map_err(|error| error.to_string())?);
    }
    
    // Delete files from disk
    for (id, path) in &files_to_delete {
        let file_path = Path::new(path);
        if file_path.exists() {
            fs::remove_file(file_path).map_err(|error| error.to_string())?;
        }
        conn.execute("DELETE FROM files WHERE id = ?1", params![id])
            .map_err(|error| error.to_string())?;
    }
    
    Ok(())
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
