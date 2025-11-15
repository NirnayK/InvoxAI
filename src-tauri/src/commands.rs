use crate::db::{get_connection, storage_dir};
use blake3;
use rusqlite::{params, Row};
use serde::Serialize;
use serde_json;
use std::collections::HashSet;
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
        "INSERT INTO files (id, hash_sha256, file_name, stored_path, size_bytes)
         VALUES (?1, ?2, ?3, ?4, ?5)",
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
