use crate::db::get_connection;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Serialize};
use serde_json;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct XmlFileRow {
    pub id: i64,
    pub xml_name: String,
    pub created_at: String,
    pub file_count: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct XmlDownloadResponse {
    pub content: String,
    pub file_count: i32,
}

fn ensure_xml_record_exists(conn: &Connection, xml_id: i64) -> Result<(), String> {
    let mut stmt = conn
        .prepare("SELECT 1 FROM xml_files WHERE id = ?1 LIMIT 1")
        .map_err(|error| error.to_string())?;
    stmt
        .query_row(params![xml_id], |_row| Ok(()))
        .optional()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "XML file record not found.".to_string())
}

fn sanitize_file_name(value: &str, fallback: &str) -> String {
    let mut result = String::with_capacity(value.len());
    let mut last_dash = false;

    for ch in value.chars() {
        if ch.is_ascii_alphanumeric() {
            result.push(ch.to_ascii_lowercase());
            last_dash = false;
        } else if ch.is_ascii_whitespace() || "-_.".contains(ch) {
            if !last_dash {
                result.push('-');
                last_dash = true;
            }
        }
    }

    let trimmed = result.trim_matches('-').to_string();
    if trimmed.is_empty() {
        fallback.to_string()
    } else {
        trimmed
    }
}

#[tauri::command]
pub fn create_xml_for_files(file_ids: Vec<String>, xml_name: String) -> Result<i64, String> {
    let conn = get_connection().map_err(|error| error.to_string())?;

    let file_ids_json = serde_json::to_string(&file_ids).map_err(|error| error.to_string())?;
    let xml_path = sanitize_file_name(&xml_name, "untitled-xml");

    conn.execute(
        "INSERT INTO xml_files (xml_name, file_ids, xml_path) VALUES (?1, ?2, ?3)",
        params![xml_name, file_ids_json, xml_path],
    )
    .map_err(|error| error.to_string())?;

    let xml_id = conn.last_insert_rowid();
    Ok(xml_id)
}

#[tauri::command]
pub fn list_xml_files() -> Result<Vec<XmlFileRow>, String> {
    let conn = get_connection().map_err(|error| error.to_string())?;
    
    let mut stmt = conn
        .prepare("SELECT id, xml_name, created_at, file_ids FROM xml_files ORDER BY created_at DESC")
        .map_err(|error| error.to_string())?;
        
    let rows_iter = stmt
        .query_map([], |row| {
            let file_ids_json: String = row.get(3)?;
            let file_ids: Vec<String> = serde_json::from_str(&file_ids_json).unwrap_or_default();
            
            Ok(XmlFileRow {
                id: row.get(0)?,
                xml_name: row.get(1)?,
                created_at: row.get(2)?,
                file_count: file_ids.len(),
            })
        })
        .map_err(|error| error.to_string())?;
        
    let mut rows = Vec::new();
    for row in rows_iter {
        rows.push(row.map_err(|error| error.to_string())?);
    }
    
    Ok(rows)
}

#[tauri::command]
pub fn append_xml_file(xml_id: i64, file_ids: Vec<String>) -> Result<(), String> {
    let conn = get_connection().map_err(|error| error.to_string())?;
    
    // Get existing file IDs
    let mut stmt = conn
        .prepare("SELECT file_ids FROM xml_files WHERE id = ?1")
        .map_err(|error| error.to_string())?;
        
    let existing_json: String = stmt
        .query_row(params![xml_id], |row| row.get(0))
        .map_err(|error| error.to_string())?;
        
    let mut existing_ids: Vec<String> = serde_json::from_str(&existing_json).map_err(|error| error.to_string())?;
    
    // Append new IDs (avoiding duplicates)
    for id in file_ids {
        if !existing_ids.contains(&id) {
            existing_ids.push(id);
        }
    }
    
    let new_json = serde_json::to_string(&existing_ids).map_err(|error| error.to_string())?;
    
    conn.execute(
        "UPDATE xml_files SET file_ids = ?1 WHERE id = ?2",
        params![new_json, xml_id],
    )
    .map_err(|error| error.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub fn generate_xml_file(xml_id: i64) -> Result<XmlDownloadResponse, String> {
    let conn = get_connection().map_err(|error| error.to_string())?;
    ensure_xml_record_exists(&conn, xml_id)?;

    // Get file IDs from the xml_files table
    let mut stmt = conn
        .prepare("SELECT file_ids FROM xml_files WHERE id = ?1")
        .map_err(|error| error.to_string())?;
    let file_ids_json: String = stmt
        .query_row(params![xml_id], |row| row.get(0))
        .map_err(|error| error.to_string())?;
    let file_ids: Vec<String> =
        serde_json::from_str(&file_ids_json).map_err(|error| error.to_string())?;

    if file_ids.is_empty() {
        return Err("No files associated with this XML export.".to_string());
    }

    // Retrieve parsed details for each file
    let placeholders = file_ids.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
    let query = format!(
        "SELECT id, file_name, parsed_details FROM files WHERE id IN ({})",
        placeholders
    );
    let mut stmt = conn.prepare(&query).map_err(|error| error.to_string())?;
    let params: Vec<&dyn rusqlite::ToSql> =
        file_ids.iter().map(|id| id as &dyn rusqlite::ToSql).collect();

    let files_iter = stmt
        .query_map(params.as_slice(), |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, Option<String>>(2)?))
        })
        .map_err(|error| error.to_string())?;

    let mut xml_content = String::new();
    let mut processed_file_count = 0;

    for file_result in files_iter {
        let (_file_id, _file_name, parsed_details) =
            file_result.map_err(|error| error.to_string())?;

        if let Some(details_json) = parsed_details {
            // Parse the JSON and add to XML content
            // The frontend will handle XML generation, but we concatenate multiple invoices
            xml_content.push_str(&details_json);
            xml_content.push_str("\n");
            processed_file_count += 1;
        }
    }

    if processed_file_count == 0 {
        return Err(
            "None of the files have been processed yet. Process files before generating XML."
                .to_string(),
        );
    }

    // Return the content directly
    Ok(XmlDownloadResponse {
        content: xml_content,
        file_count: processed_file_count,
    })
}
