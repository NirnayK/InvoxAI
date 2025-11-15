use crate::db::{get_connection, storage_dir};
use blake3;
use rusqlite::{params, Row};
use serde::Serialize;
use std::fs;
use std::io::Read;
use std::path::Path;
use uuid::Uuid;

#[derive(Serialize)]
pub struct FileRow {
    pub id: String,
    pub file_name: String,
    pub hash: String,
}

fn file_row_from_row(row: &Row) -> rusqlite::Result<FileRow> {
    Ok(FileRow {
        id: row.get(0)?,
        file_name: row.get(1)?,
        hash: row.get(2)?,
    })
}

#[tauri::command]
pub fn import_file(path: String) -> Result<String, String> {
    let mut file = fs::File::open(&path).map_err(|error| error.to_string())?;
    let mut buf = Vec::new();
    file.read_to_end(&mut buf).map_err(|error| error.to_string())?;

    let hash = blake3::hash(&buf);
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
    let original_path = Path::new(&path);

    let ext = original_path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("");

    let file_name = original_path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("file");

    let stored_path = if ext.is_empty() {
        storage.join(&id)
    } else {
        storage.join(format!("{}.{}", &id, ext))
    };

    fs::write(&stored_path, &buf).map_err(|error| error.to_string())?;

    conn.execute(
        "INSERT INTO files (id, hash_sha256, file_name, stored_path, size_bytes)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            id,
            hash_hex,
            file_name,
            stored_path.to_string_lossy().to_string(),
            buf.len() as i64
        ],
    )
    .map_err(|error| error.to_string())?;

    Ok(format!("OK:{}", id))
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
