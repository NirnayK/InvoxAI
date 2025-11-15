#![windows_subsystem = "windows"]

mod commands;
mod db;
mod filesystem;
mod sql;

use commands::{import_file, list_files};
use filesystem::{create_directory, list_directory, read_file, save_file};
use sql::schema_migrations;
use tauri_plugin_sql::Builder as SqlPluginBuilder;

fn main() {
    tauri::Builder::default()
        .plugin(
            SqlPluginBuilder::default()
                .add_migrations("sqlite:app.db", schema_migrations())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            list_directory,
            read_file,
            save_file,
            create_directory,
            import_file,
            list_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running Invox AI desktop shell");
}
