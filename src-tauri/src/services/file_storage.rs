use std::fs;
use std::path::{Path, PathBuf};
use crate::db::storage_dir;

pub struct FileStorage;

impl FileStorage {
    pub fn save_file(id: &str, file_name: &str, buffer: &[u8]) -> Result<PathBuf, String> {
        let storage = storage_dir().map_err(|error| error.to_string())?;
        let original_path = Path::new(file_name);

        let ext = original_path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("");

        let stored_path = if ext.is_empty() {
            storage.join(id)
        } else {
            storage.join(format!("{}.{}", id, ext))
        };

        fs::write(&stored_path, buffer).map_err(|error| error.to_string())?;

        Ok(stored_path)
    }
}
