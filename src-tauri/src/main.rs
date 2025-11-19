#![windows_subsystem = "windows"]

mod commands;
mod db;
mod filesystem;

use commands::{
    append_log_entry, append_sheet_rows, clear_processed_files, generate_sheet_xlsx,
    get_storage_stats, import_data, import_file, list_files,
};
use filesystem::{create_directory, list_directory, read_binary_file, read_file, save_file};
use db::schema_migrations;
use tauri_plugin_dialog::init as DialogPlugin;
use tauri_plugin_sql::Builder as SqlPluginBuilder;
use tauri_plugin_store::Builder as StorePluginBuilder;

fn main() {
    tauri::Builder::default()
        .plugin(
            SqlPluginBuilder::default()
                .add_migrations("sqlite:app.db", schema_migrations())
                .build(),
        )
        .plugin(DialogPlugin())
        .plugin(StorePluginBuilder::default().build())
        .invoke_handler(tauri::generate_handler![
            list_directory,
            read_binary_file,
            read_file,
            save_file,
            create_directory,
            import_file,
            import_data,
            list_files,
            get_storage_stats,
            clear_processed_files,
            append_log_entry,
            append_sheet_rows,
            generate_sheet_xlsx
        ])
        .run(tauri::generate_context!())
        .expect("error while running Invox AI desktop shell");
}
