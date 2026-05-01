use std::{env, fs};
use std::path::Path;

#[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
pub fn current_exe_string() -> Result<String, String> {
    env::current_exe()
        .map_err(|e| format!("failed to resolve current executable: {e}"))
        .map(|p| p.to_string_lossy().into_owned())
}

pub fn ensure_parent_dir(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("failed to create {:?}: {e}", parent))?;
    }
    Ok(())
}
