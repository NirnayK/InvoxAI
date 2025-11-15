use tauri_plugin_sql::{Migration, MigrationKind};

pub fn schema_migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create core tables".into(),
            sql: r#"
                CREATE TABLE IF NOT EXISTS task (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    files_associated TEXT NOT NULL DEFAULT '[]',
                    file_count INTEGER NOT NULL DEFAULT 0,
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
                    hash_sha256 TEXT UNIQUE NOT NULL,
                    file_name TEXT NOT NULL,
                    stored_path TEXT NOT NULL,
                    size_bytes INTEGER NOT NULL,
                    mime_type TEXT,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
            "#
            .into(),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add task status column".into(),
            sql: r#"
                ALTER TABLE task ADD COLUMN status TEXT NOT NULL DEFAULT 'Processing';
            "#
            .into(),
            kind: MigrationKind::Up,
        },
    ]
}
