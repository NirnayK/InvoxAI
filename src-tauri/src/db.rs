use std::fs;
use std::path::PathBuf;
use rusqlite::{Connection, Error as SqlError, Result as SqlResult};
use tauri_plugin_sql::{Migration, MigrationKind};

const APP_DIR_NAME: &str = "com.invox.ai";
const DB_FILE_NAME: &str = "app.db";

const CORE_SCHEMA: &str = r#"
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      hash_sha256 TEXT NOT NULL UNIQUE,
      file_name TEXT NOT NULL,
      stored_path TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      mime_type TEXT,
      status TEXT NOT NULL DEFAULT 'Unprocessed',
      parsed_details TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      processed_at TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS files_hash_idx ON files(hash_sha256);
    CREATE INDEX IF NOT EXISTS files_status_idx ON files(status);

    CREATE TRIGGER IF NOT EXISTS files_touch_updated_at
    AFTER UPDATE ON files
    FOR EACH ROW
    WHEN NEW.updated_at <= OLD.updated_at
    BEGIN
      UPDATE files SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
    END;

    CREATE TABLE IF NOT EXISTS xml_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      xml_name TEXT NOT NULL,
      file_ids TEXT NOT NULL DEFAULT '[]',
      xml_path TEXT NOT NULL,
      xml_file_path TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TRIGGER IF NOT EXISTS xml_files_touch_updated_at
    AFTER UPDATE ON xml_files
    FOR EACH ROW
    WHEN NEW.updated_at <= OLD.updated_at
    BEGIN
      UPDATE xml_files SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
    END;
"#;

fn base_data_dir() -> PathBuf {
    let base = dirs::data_dir().unwrap_or_else(|| std::env::current_dir().unwrap());
    base
}

fn app_data_dir() -> PathBuf {
    base_data_dir().join(APP_DIR_NAME)
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
        SqlError::SqliteFailure(
            rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_IOERR),
            Some(e.to_string()),
        )
    })?;

    let conn = Connection::open(path)?;
    init_schema(&conn)?;
    Ok(conn)
}

fn init_schema(conn: &Connection) -> SqlResult<()> {
    conn.execute_batch(CORE_SCHEMA)?;
    ensure_processed_at_column(conn)?;
    Ok(())
}

fn ensure_processed_at_column(conn: &Connection) -> SqlResult<()> {
    let mut stmt = conn.prepare("PRAGMA table_info(files)")?;
    let mut has_column = false;

    let mut rows = stmt.query([])?;
    while let Some(row) = rows.next()? {
        let name: String = row.get(1)?;
        if name == "processed_at" {
            has_column = true;
            break;
        }
    }

    if !has_column {
        conn.execute("ALTER TABLE files ADD COLUMN processed_at TEXT", [])?;
    }

    Ok(())
}

pub fn schema_migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "initial schema".into(),
            sql: CORE_SCHEMA.into(),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "drop orphaned sheets table".into(),
            sql: "DROP TABLE IF EXISTS sheets;".into(),
            kind: MigrationKind::Up,
        },
    ]
}
