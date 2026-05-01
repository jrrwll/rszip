use super::{CompressInfo, CompressParam, DecompressInfo, Entry};

#[tauri::command]
pub fn get_default_dir() -> String {
    dirs::home_dir().expect("Failed to get home directory")
        .to_string_lossy().to_string()
}

#[tauri::command]
pub fn list_dir(_path: String, _password: Option<String>) -> Vec<Entry> {
    vec![]
}

#[tauri::command]
pub fn decompress(_path: String, _password: Option<String>, _target_dir: Option<String>) -> DecompressInfo {
    todo!()
}

#[tauri::command]
pub fn decompress_test(_path: String, _password: Option<String>) -> DecompressInfo {
    todo!()
}

#[tauri::command]
pub fn compress(_path: Vec<String>, _compress_param: CompressParam, _target_filename: Option<String>) -> CompressInfo {
    todo!()
}

#[tauri::command]
pub fn compress_add(_path: String, _file_path: String, _password: Option<String>) -> CompressInfo {
    todo!()
}

#[tauri::command]
pub fn compress_remove(_path: Vec<String>, _password: Option<String>) -> CompressInfo {
    todo!()
}

#[tauri::command]
pub fn compress_info(_path: String, _password: Option<String>) -> CompressInfo {
    todo!()
}

#[tauri::command]
pub fn compress_rename(_path: String, _new_name: String, _password: Option<String>) -> CompressInfo {
    todo!()
}

#[tauri::command]
pub fn compress_password_detect(_compress_path: String) -> bool {
    todo!()
}
