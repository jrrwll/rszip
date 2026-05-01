use rszip_lib::*;
use rszip_lib::file::*;
use std::fs;

#[test]
fn desktop_entry_matches_directory_only() {
    let content = linux_desktop_entry("/tmp/rszip", "rszip");
    assert!(content.contains("MimeTypes=inode/directory;"));
    assert!(content.contains("Exec=/tmp/rszip \"%f\""));
    assert!(content.contains("Name=Open with rszip"));
}

fn linux_desktop_entry(exe: &str, icon_name: &str) -> String {
    format!(
        "[Desktop Entry]\nType=Action\nName=Open with rszip\nIcon={}\nProfiles=profile-zero;\n\n[X-Action-Profile profile-zero]\nMimeTypes=inode/directory;\nExec={} \"%f\"\n",
        icon_name, exe
    )
}

#[test]
fn windows_command_quotes_executable_and_argument() {
    let cmd = windows_directory_command(r#"C:\Program Files\rszip\rszip.exe"#);
    assert_eq!(cmd, r#""C:\Program Files\rszip\rszip.exe" "%1""#);
}

fn windows_directory_command(exe: &str) -> String {
    format!(r#""{}" "%1""#, exe)
}

#[test]
fn supports_dir_target_only_when_requested() {
    assert!(context_menu_enabled_for_targets(&["dir".into()]));
    assert!(!context_menu_enabled_for_targets(&[]));
    assert!(!context_menu_enabled_for_targets(&["zip".into()]));
}

fn context_menu_enabled_for_targets(targets: &[String]) -> bool {
    targets.iter().any(|t| t == CONTEXT_KEY)
}

#[test]
fn extracts_first_valid_directory_argument() {
    let dir1 = tempfile::tempdir().expect("temp dir 1");
    let dir2 = tempfile::tempdir().expect("temp dir 2");
    let fake_file = dir1.path().join("a.txt");
    fs::write(&fake_file, "x").expect("write file");

    let args = vec![
        "rszip".to_string(),
        "--flag".to_string(),
        fake_file.to_string_lossy().into_owned(),
        dir1.path().to_string_lossy().into_owned(),
        dir2.path().to_string_lossy().into_owned(),
    ];

    let got = extract_first_directory_arg_from_iter(args);
    assert_eq!(got, Some(dir1.path().to_string_lossy().into_owned()));
}

#[test]
fn returns_none_when_no_directory_argument_exists() {
    let args = vec!["rszip".to_string(), "--flag".to_string(), "/no/such/path".to_string()];
    let got = extract_first_directory_arg_from_iter(args);
    assert_eq!(got, None);
}
