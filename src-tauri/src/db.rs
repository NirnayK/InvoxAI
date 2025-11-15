use std::fs;
use std::path::{PathBuf};

use rusqlite::{Connection, Error as SqlError, Result as SqlResult};

const APP_DIR_NAME: &str = "invox_ai";
const DB_FILE_NAME: &str = "app.db";

fn app_data_dir() -> PathBuf {
    let base = dirs::data_dir().unwrap_or_else(|| std::env::current_dir().unwrap());
    base.join(APP_DIR_NAME)
}

fn ensure_dirs() -> std::io::Result<PathBuf> {
    let dir = app_data_dir();
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

pub fn db_path() -> std::io::Result<PathBuf> {
    let dir = ensure_dirs()?;
    Ok(dir.join(DB_FILE_NAME))
}

pub fn storage_dir() -> std::io::Result<PathBuf> {
    let dir = ensure_dirs()?;
    let storage = dir.join("files");
    fs::create_dir_all(&storage)?;
    Ok(storage)
}

pub fn get_connection() -> SqlResult<Connection> {
    let path = db_path().map_err(|e| {
        SqlError::SqliteFailure(rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_IOERR), Some(e.to_string()))
    })?;

    let conn = Connection::open(path)?;
    init_schema(&conn)?;
    Ok(conn)
}

fn init_schema(conn: &Connection) -> SqlResult<()> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS files (
          id TEXT PRIMARY KEY,
          hash_sha256 TEXT NOT NULL UNIQUE,
          file_name TEXT NOT NULL,
          stored_path TEXT NOT NULL,
          size_bytes INTEGER NOT NULL,
          mime_type TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        "#,
    )?;
    Ok(())
}
