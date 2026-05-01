use tauri::{AppHandle, Manager};
use super::{PendingOpenPath};

#[tauri::command]
pub fn take_pending_open_path(app: AppHandle) -> Option<String> {
    take_pending_open_path_state(&app)
}

#[tauri::command]
pub fn load_recent() -> Vec<String> {
    vec![]
}

#[tauri::command]
pub fn save_recent(_paths: Vec<String>) {
    println!("save recent {:?}", &_paths);
}

fn take_pending_open_path_state(app: &AppHandle) -> Option<String> {
    let state = app.state::<PendingOpenPath>();
    let mut guard = state.0.lock().ok()?;
    guard.take()
}
