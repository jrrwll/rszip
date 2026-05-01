use winreg::{enums::HKEY_CURRENT_USER, RegKey};

use std::collections::HashMap;

use crate::file::current_exe_string;

pub fn windows_get_context_menu_enabled_impl() -> Result<HashMap<String, bool>, String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let enabled = windows_context_menu_paths()
        .iter()
        .any(|path| hkcu.open_subkey(path).is_ok());
    let mut map = HashMap::new();
    map.insert(crate::platform::context_menu::CONTEXT_KEY.to_string(), enabled);
    Ok(map)
}

pub fn windows_set_context_menu_enabled_impl(enabled: bool) -> Result<(), String> {
    let exe = current_exe_string()?;
    if enabled {
        for path in windows_context_menu_paths() {
            let key = windows_open_regkey(path)?;
            key.set_value("", &"Open with rszip")
                .map_err(|e| format!("failed to set registry title: {e}"))?;
            key.set_value("Icon", &exe)
                .map_err(|e| format!("failed to set registry icon: {e}"))?;
            let command = windows_open_regkey(&format!(r"{}\command", path))?;
            let arg = if path.contains("Background") { "%V" } else { "%1" };
            command
                .set_value("", &format!(r#""{}" "{}""#, exe, arg))
                .map_err(|e| format!("failed to set registry command: {e}"))?;
        }
    } else {
        for path in windows_context_menu_paths() {
            windows_delete_regkey(path)?;
        }
    }
    Ok(())
}

fn windows_delete_regkey(path: &str) -> Result<(), String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    match hkcu.delete_subkey_all(path) {
        Ok(_) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("failed to delete registry key {path}: {e}")),
    }
}

fn windows_context_menu_paths() -> [&'static str; 2] {
    [
        r"Software\Classes\Directory\shell\rszip",
        r"Software\Classes\Directory\Background\shell\rszip",
    ]
}

fn windows_open_regkey(path: &str) -> Result<winreg::RegKey, String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    hkcu.create_subkey(path)
        .map(|(k, _)| k)
        .map_err(|e| format!("failed to open registry key {path}: {e}"))
}
