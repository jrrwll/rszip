use crate::file::{current_exe_string, ensure_parent_dir};

use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::process::Command;

#[cfg(target_os = "linux")]
const APP_DESKTOP_ID: &str = "rszip.desktop";

pub fn linux_get_context_menu_enabled_impl() -> Result<HashMap<String, bool>, String> {
    let mut map = HashMap::new();
    let path = linux_context_entry_path()?;
    map.insert(crate::platform::context_menu::CONTEXT_KEY.to_string(), path.exists());
    Ok(map)
}

pub fn linux_set_context_menu_enabled_impl(enabled: bool) -> Result<(), String> {
    let path = linux_context_entry_path()?;
    if enabled {
        ensure_parent_dir(&path)?;
        let content = linux_desktop_entry(&current_exe_string()?, "rszip");
        fs::write(&path, content).map_err(|e| format!("failed to write {:?}: {e}", path))?;
        linux_refresh_desktop_db();
    } else if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("failed to remove {:?}: {e}", path))?;
        linux_refresh_desktop_db();
    }
    Ok(())
}


fn linux_context_entry_path() -> Result<PathBuf, String> {
    let base = dirs::home_dir().ok_or_else(|| "failed to resolve HOME".to_string())?;
    Ok(base
        .join(".local/share/file-manager/actions")
        .join(APP_DESKTOP_ID))
}

fn linux_refresh_desktop_db() {
    if let Some(home) = dirs::home_dir() {
        let _ = Command::new("update-desktop-database")
            .arg(home.join(".local/share"))
            .status();
    }
}
