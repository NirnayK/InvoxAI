use crate::db::storage_dir;
use chrono::Utc;
use std::fs;
use std::io::Write;
use std::path::PathBuf;

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
