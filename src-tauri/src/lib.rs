use std::env;

use tauri::{AppHandle, Emitter, Manager};

pub mod compress;
pub mod file;
pub mod platform;

use compress::*;
use file::*;
use platform::*;

pub const CONTEXT_KEY: &str = "dir";

const EXTERNAL_OPEN_EVENT: &str = "external-opened";

pub fn set_pending_open_path(app: &AppHandle, path: String) {
    let state = app.state::<PendingOpenPath>();
    let mut guard = match state.0.lock() {
        Ok(guard) => guard,
        Err(_) => return,
    };
    *guard = Some(path);
}

pub fn emit_external_opened(app: &AppHandle, path: &str) {
    let _ = app.emit(EXTERNAL_OPEN_EVENT, path.to_string());
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(PendingOpenPath::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(path) = extract_first_directory_arg_from_iter(argv) {
                set_pending_open_path(app, path.clone());
                emit_external_opened(app, &path);
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        }))
        .setup(|app| {
            if let Some(path) = extract_first_directory_arg_from_iter(env::args()) {
                set_pending_open_path(&app.handle(), path);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_default_dir,
            list_dir,
            decompress,
            decompress_test,
            compress,
            compress_add,
            compress_remove,
            compress_info,
            compress_rename,
            compress_password_detect,
            get_default_handlers,
            set_default_handlers,
            get_context_menu_enabled,
            set_context_menu_enabled,
            take_pending_open_path,
            load_recent,
            save_recent,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
