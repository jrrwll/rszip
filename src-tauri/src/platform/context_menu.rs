use std::collections::HashMap;

use crate::platform::*;

pub const CONTEXT_KEY: &str = "dir";

#[tauri::command]
pub fn get_context_menu_enabled() -> HashMap<String, bool> {
    #[cfg(target_os = "linux")]
    {
        linux_get_context_menu_enabled_impl().unwrap_or_default()
    }
    #[cfg(target_os = "windows")]
    {
        windows_get_context_menu_enabled_impl().unwrap_or_default()
    }
    #[cfg(target_os = "macos")]
    {
        mac_get_context_menu_enabled_impl().unwrap_or_default()
    }
    #[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
    {
        platform_get_context_menu_enabled_impl().unwrap_or_default()
    }
}

#[tauri::command]
pub fn set_context_menu_enabled(targets: Vec<String>) -> Result<(), String> {
    let enabled = targets.iter().any(|t| t == CONTEXT_KEY);
    #[cfg(target_os = "linux")]
    {
        linux_set_context_menu_enabled_impl(enabled)
    }
    #[cfg(target_os = "windows")]
    {
        windows_set_context_menu_enabled_impl(enabled)
    }
    #[cfg(target_os = "macos")]
    {
        mac_set_context_menu_enabled_impl(enabled)
    }
    #[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
    {
        platform_set_context_menu_enabled_impl(enabled)
    }
}

#[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
fn platform_get_context_menu_enabled_impl() -> Result<HashMap<String, bool>, String> {
    Ok(HashMap::new())
}

#[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
fn platform_set_context_menu_enabled_impl(_enabled: bool) -> Result<(), String> {
    Ok(())
}
