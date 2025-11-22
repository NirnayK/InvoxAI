use crate::db::{get_connection, storage_dir};
use blake3;
use chrono::Utc;
use rusqlite::{params, Row};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::path::Path;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum FileStatus {
    Unprocessed,
    Processing,
    Processed,
    Failed,
}

impl FileStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            FileStatus::Unprocessed => "Unprocessed",
            FileStatus::Processing => "Processing",
            FileStatus::Processed => "Processed",
            FileStatus::Failed => "Failed",
        }
    }
}

impl std::str::FromStr for FileStatus {
    type Err = String;
    
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "Unprocessed" => Ok(FileStatus::Unprocessed),
            "Processing" => Ok(FileStatus::Processing),
            "Processed" => Ok(FileStatus::Processed),
            "Failed" => Ok(FileStatus::Failed),
            _ => Err(format!("Invalid file status: {}", s)),
        }
    }
}

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
    pub status: FileStatus,
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
            let status_str: String = row.get(5)?;
            let status = status_str.parse::<FileStatus>()
                .unwrap_or(FileStatus::Unprocessed);
            
            Ok(FileRecord {
                id: row.get(0)?,
                file_name: row.get(1)?,
                stored_path: row.get(2)?,
                size_bytes: row.get(3)?,
                mime_type: row.get(4)?,
                status,
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
pub fn update_file_status(file_id: String, status: FileStatus) -> Result<(), String> {
    let conn = get_connection().map_err(|error| error.to_string())?;
    
    let processed_at = if status == FileStatus::Processed {
        Some(Utc::now().to_rfc3339())
    } else {
        None
    };
    
    conn.execute(
        "UPDATE files SET status = ?1, processed_at = ?2 WHERE id = ?3",
        params![status.as_str(), processed_at, file_id],
    )
    .map_err(|error| error.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub fn update_file_parsed_details(file_id: String, parsed_details: String) -> Result<(), String> {
    let conn = get_connection().map_err(|error| error.to_string())?;
    
    conn.execute(
        "UPDATE files SET parsed_details = ?1 WHERE id = ?2",
        params![parsed_details, file_id],
    )
    .map_err(|error| error.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub fn update_files_status(file_ids: Vec<String>, status: FileStatus) -> Result<(), String> {
    if file_ids.is_empty() {
        return Ok(());
    }
    
    let conn = get_connection().map_err(|error| error.to_string())?;
    
    let processed_at = if status == FileStatus::Processed {
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
        Box::new(status.as_str().to_string()),
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
