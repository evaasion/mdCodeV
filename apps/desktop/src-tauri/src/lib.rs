mod fs;
mod fxserver;
mod game;
mod plugins;
mod remote;
mod sql;
mod sql_keychain;
mod ai_keychain;

use fxserver::FxServerState;
use remote::SftpState;
use sql::SqlState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(FxServerState::new())
        .manage(SftpState(std::sync::Mutex::new(None)))
        .manage(SqlState(std::sync::Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            fs::read_file,
            fs::write_file,
            fs::create_directory,
            fs::list_directory,
            fs::list_project_tree,
            fs::detect_project,
            fs::write_scaffold,
            fxserver::find_fxserver_binary,
            fxserver::start_fxserver,
            fxserver::stop_fxserver,
            fxserver::send_server_command,
            fxserver::fxserver_status,
            game::find_fivem_client,
            game::launch_fivem_connect,
            plugins::list_plugin_files,
            plugins::read_plugin_file,
            plugins::ensure_plugins_dir,
            remote::sftp_connect,
            remote::sftp_disconnect,
            remote::sftp_status,
            remote::sftp_list_directory,
            remote::sftp_read_file,
            remote::sftp_write_file,
            remote::sftp_list_project_tree,
            remote::sftp_detect_project,
            remote::sftp_write_scaffold,
            remote::sftp_list_plugin_files,
            remote::sftp_ensure_plugins_dir,
            remote::ssh_exec,
            remote::ssh_send_console_command,
            remote::ssh_fetch_logs,
            sql::sql_connect,
            sql::sql_disconnect,
            sql::sql_status,
            sql::sql_query,
            sql::sql_list_databases,
            sql::sql_list_tables,
            sql::sql_describe_table,
            sql::sql_show_create_table,
            sql::sql_export_table_dump,
            sql::sql_execute_script,
            sql::sql_show_indexes,
            sql::sql_add_column,
            sql::sql_create_index,
            sql::sql_drop_index,
            sql_keychain::sql_keychain_save,
            sql_keychain::sql_keychain_get,
            sql_keychain::sql_keychain_delete,
            ai_keychain::ai_keychain_save,
            ai_keychain::ai_keychain_get,
            ai_keychain::ai_keychain_delete,
        ])
        .run(tauri::generate_context!())
        .expect("error while running mdcodeV");
}