use std::fs;
use std::path::PathBuf;
use rusqlite::{Connection, Error as SqlError, Result as SqlResult};
use tauri_plugin_sql::{Migration, MigrationKind};

const APP_DIR_NAME: &str = "com.invox.ai";
const DB_FILE_NAME: &str = "app.db";

const CORE_SCHEMA: &str = r#"
    CREATE TABLE IF NOT EXISTS task (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      files_associated TEXT NOT NULL DEFAULT '[]',
      file_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Pending',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TRIGGER IF NOT EXISTS task_touch_updated_at
    AFTER UPDATE ON task
    FOR EACH ROW
    WHEN NEW.updated_at <= OLD.updated_at
    BEGIN
      UPDATE task SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
    END;

    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      hash_sha256 TEXT NOT NULL UNIQUE,
      file_name TEXT NOT NULL,
      stored_path TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      mime_type TEXT,
      status TEXT NOT NULL DEFAULT 'Unprocessed',
      parsed_details TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS files_hash_idx ON files(hash_sha256);

    CREATE TABLE IF NOT EXISTS sheets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER,
      sheet_path TEXT NOT NULL,
      sheet_file_path TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(task_id) REFERENCES task(id) ON DELETE SET NULL
    );

    CREATE TRIGGER IF NOT EXISTS sheets_touch_updated_at
    AFTER UPDATE ON sheets
    FOR EACH ROW
    WHEN NEW.updated_at <= OLD.updated_at
    BEGIN
      UPDATE sheets SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
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
        // To add future migrations, append entries with incremented `version`,
        // a short `description`, and the SQL change that updates the schema.
        // Example:
        // Migration {
        //     version: 2,
        //     description: "add processed flag",
        //     sql: "ALTER TABLE task ADD COLUMN processed INTEGER NOT NULL DEFAULT 0;".into(),
        //     kind: MigrationKind::Up,
        // },
    ]
}
