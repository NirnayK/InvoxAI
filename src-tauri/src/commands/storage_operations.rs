use crate::db::storage_dir;
use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageStats {
    pub path: String,
    pub total_bytes: u64,
    pub file_count: u64,
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
pub fn get_storage_stats() -> Result<StorageStats, String> {
    compute_storage_stats()
}

#[tauri::command]
pub fn clear_processed_files() -> Result<StorageStats, String> {
    let dir = storage_dir().map_err(|error| error.to_string())?;

    if dir.exists() {
        for entry in fs::read_dir(&dir).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            let path = entry.path();

            if path.is_file() {
                fs::remove_file(&path).map_err(|error| error.to_string())?;
            } else if path.is_dir() {
                fs::remove_dir_all(&path).map_err(|error| error.to_string())?;
            }
        }
    }

    compute_storage_stats()
}
