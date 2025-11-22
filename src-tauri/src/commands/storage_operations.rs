use crate::db::storage_dir;
use serde::Serialize;
use std::fs;

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
