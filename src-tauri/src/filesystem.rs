use serde::Serialize;
use std::fs;
use std::path::PathBuf;

#[derive(Serialize)]
pub struct DirectoryEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_file: bool,
}

#[tauri::command]
pub fn list_directory(path: Option<String>) -> Result<Vec<DirectoryEntry>, String> {
    let target_path = path.unwrap_or_else(|| ".".to_owned());
    let resolved_path = PathBuf::from(&target_path);

    let entries = fs::read_dir(&resolved_path)
        .map_err(|error| error.to_string())?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let metadata = entry.metadata().ok()?;
            Some(DirectoryEntry {
                name: entry.file_name().to_string_lossy().into_owned(),
                path: entry.path().to_string_lossy().into_owned(),
                is_dir: metadata.is_dir(),
                is_file: metadata.is_file(),
            })
        })
        .collect();

    Ok(entries)
}

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(path).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_file(path: String, contents: String, overwrite: Option<bool>) -> Result<(), String> {
    let target = PathBuf::from(&path);

    if overwrite == Some(false) && target.exists() {
        return Err("File already exists".to_owned());
    }

    fs::write(target, contents).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn create_directory(path: String, recursive: Option<bool>) -> Result<(), String> {
    let target = PathBuf::from(&path);
    let create_recursive = recursive.unwrap_or(true);

    if create_recursive {
        fs::create_dir_all(target).map_err(|error| error.to_string())
    } else {
        fs::create_dir(target).map_err(|error| error.to_string())
    }
}
