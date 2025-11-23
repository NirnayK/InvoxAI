#![windows_subsystem = "windows"]

mod commands;
mod db;
mod filesystem;
mod services;

use commands::{
    append_log_entry, append_xml_file, copy_file_to_path, create_xml_for_files, delete_files, generate_xml_file,
    get_storage_stats, import_data, import_file, list_files, list_files_paginated, list_xml_files,
    open_file_paths, update_file_parsed_details, update_file_status, update_files_status,
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
            list_files_paginated,
            get_storage_stats,
            append_log_entry,
            create_xml_for_files,
            list_xml_files,
            append_xml_file,
            generate_xml_file,
            update_file_status,
            update_file_parsed_details,
            update_files_status,
            delete_files,
            open_file_paths,
            copy_file_to_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running Invox AI desktop shell");
}
