use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use crate::file::{current_exe_string, ensure_parent_dir};

pub fn mac_get_context_menu_enabled_impl() -> Result<HashMap<String, bool>, String> {
    let mut map = HashMap::new();
    map.insert(crate::platform::context_menu::CONTEXT_KEY.to_string(), mac_services_plist_path()?.exists());
    Ok(map)
}

pub fn mac_set_context_menu_enabled_impl(enabled: bool) -> Result<(), String> {
    let plist = mac_services_plist_path()?;
    if enabled {
        ensure_parent_dir(&plist)?;
        fs::write(&plist, mac_service_plist(&current_exe_string()?))
            .map_err(|e| format!("failed to write services plist: {e}"))?;
    } else if plist.exists() {
        fs::remove_file(&plist).map_err(|e| format!("failed to remove services plist: {e}"))?;
    }
    let _ = Command::new("/System/Library/CoreServices/pbs")
        .arg("-update")
        .status();
    Ok(())
}

fn mac_services_plist_path() -> Result<PathBuf, String> {
    let base = dirs::home_dir().ok_or_else(|| "failed to resolve HOME".to_string())?;
    Ok(base.join("Library/Application Support/rszip/FinderServices.plist"))
}

fn mac_service_plist(exe: &str) -> String {
    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSServices</key>
  <array>
    <dict>
      <key>NSMenuItem</key>
      <dict>
        <key>default</key>
        <string>Open with rszip</string>
      </dict>
      <key>NSMessage</key>
      <string>openFiles</string>
      <key>NSPortName</key>
      <string>rszip</string>
      <key>NSSendFileTypes</key>
      <array>
        <string>public.folder</string>
      </array>
      <key>NSExecutable</key>
      <string>{}</string>
    </dict>
  </array>
</dict>
</plist>
"#,
        exe
    )
}
