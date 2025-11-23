use crate::db::get_connection;
use rusqlite::params;

pub struct FileMetadata;

impl FileMetadata {
    pub fn check_duplicate(hash: &str) -> Result<Option<String>, String> {
        let conn = get_connection().map_err(|error| error.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id FROM files WHERE hash_sha256 = ?1 LIMIT 1")
            .map_err(|error| error.to_string())?;

        let existing: Result<String, _> = stmt.query_row(params![hash], |row| row.get(0));

        match existing {
            Ok(id) => Ok(Some(id)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    }

    pub fn save_metadata(
        id: &str,
        hash: &str,
        file_name: &str,
        stored_path: &str,
        size: i64,
    ) -> Result<(), String> {
        let conn = get_connection().map_err(|error| error.to_string())?;
        
        conn.execute(
            "INSERT INTO files (id, hash_sha256, file_name, stored_path, size_bytes, parsed_details)
             VALUES (?1, ?2, ?3, ?4, ?5, NULL)",
            params![
                id,
                hash,
                file_name,
                stored_path,
                size
            ],
        )
        .map_err(|error| error.to_string())?;

        Ok(())
    }
}
