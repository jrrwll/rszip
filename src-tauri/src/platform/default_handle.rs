use std::collections::HashMap;

#[tauri::command]
pub fn get_default_handlers() -> HashMap<String, String> {
    todo!()
}

#[tauri::command]
pub fn set_default_handlers(_exts: Vec<String>) {
    todo!()
}
