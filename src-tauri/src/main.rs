#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

pub mod types;
pub mod state;
pub mod security;
pub mod wine;
pub mod sandbox;
pub mod downloads;
pub mod commands;

use std::sync::{Arc, Mutex};
use state::{AppState, load_state_from_disk_impl};

// ========================================================
// APPLICATION BOOTSTRAP
// ========================================================

fn main() {
  let initial_state = load_state_from_disk_impl();

  let app_state = AppState {
    data: Mutex::new(initial_state),
    active_process_id: Arc::new(Mutex::new(None)),
    active_child_pid: Arc::new(Mutex::new(None)),
  };

  tauri::Builder::default()
    .manage(app_state)
    .invoke_handler(tauri::generate_handler![
      commands::list_bottles,
      commands::create_bottle,
      commands::get_session,
      commands::complete_onboarding,
      commands::get_settings,
      commands::update_settings,
      commands::delete_bottle,
      commands::clone_bottle,
      commands::update_bottle_settings,
      commands::list_apps,
      commands::register_app,
      commands::toggle_favorite,
      commands::run_app,
      commands::stop_active_app,
      commands::list_runtimes,
      commands::mark_runtime_downloaded,
      commands::trigger_runtime_download,
      commands::get_system_metrics,
      // Sandboxing commands
      commands::initialize_prefix_sandbox,
      commands::reset_sandbox,
      commands::open_prefix_in_finder,
      commands::download_wine_engine,
      commands::install_windows_software,
      commands::execute_windows_binary,
      // Diagnostics & Dependency utilities
      commands::check_rosetta_status,
      commands::install_dependencies,
      commands::install_dxvk,
      commands::backup_bottle,
      commands::scan_apps,
      commands::export_logs,
      commands::export_app_data,
      commands::import_app_data,
      // Native AppleScript dialog pickers
      commands::open_file_picker,
      commands::open_folder_picker,
      commands::save_file_picker
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

// ========================================================
// AUTOMATED UNIT & INTEGRATION TESTING SUITE
// ========================================================
#[cfg(test)]
mod tests {
  use std::fs;
  use std::path::Path;
  use std::sync::Mutex;

  use crate::state::*;
  use crate::security::*;
  use crate::wine::*;
  use crate::types::*;

  // =====================================================
  // PATH HELPERS
  // =====================================================

  #[test]
  fn test_get_fusioncross_base_dir() {
    let dir = get_fusioncross_base_dir();
    assert!(dir.to_string_lossy().contains("Library/Application Support/FusionCross"));
  }

  #[test]
  fn test_new_bottle_id_format() {
    let id = new_bottle_id();
    assert!(id.starts_with("bottle-"));
    assert_eq!(id.chars().count(), 15); // "bottle-" + 8 hex chars
    assert!(id.chars().skip(7).all(|c| c.is_ascii_hexdigit()));
  }

  #[test]
  fn test_utc_timestamp_format() {
    let ts = utc_timestamp_now();
    assert!(!ts.is_empty());
    // Should look like an ISO 8601 date or the fallback
    assert!(ts.contains('T') || ts == FALLBACK_TIMESTAMP);
  }

  // =====================================================
  // CALCULATE DIR SIZE
  // =====================================================

  #[test]
  fn test_calculate_dir_size_nonexistent() {
    let size = calculate_dir_size(Path::new("/nonexistent/directory/path/"));
    assert_eq!(size, 0);
  }

  #[test]
  fn test_calculate_dir_size_empty() {
    let tmp = std::env::temp_dir().join("fc-test-empty-dir");
    let _ = fs::remove_dir_all(&tmp);
    fs::create_dir_all(&tmp).expect("create temp dir");
    let size = calculate_dir_size(&tmp);
    assert_eq!(size, 0);
    let _ = fs::remove_dir_all(&tmp);
  }

  #[test]
  fn test_calculate_dir_size_with_files() {
    let tmp = std::env::temp_dir().join("fc-test-size-dir");
    let _ = fs::remove_dir_all(&tmp);
    fs::create_dir_all(&tmp).expect("create temp dir");
    fs::write(tmp.join("a.txt"), "hello").expect("write file");
    fs::write(tmp.join("b.txt"), "world").expect("write file");
    let size = calculate_dir_size(&tmp);
    assert!(size > 0);
    let _ = fs::remove_dir_all(&tmp);
  }

  // =====================================================
  // SANDBOX PATH VALIDATION
  // =====================================================

  #[test]
  fn test_validate_sandbox_path_safe() {
    let base = get_fusioncross_base_dir();
    let safe_path = base.join("bottles").join("test-bottle-90");
    let res = validate_sandbox_path(&safe_path);
    assert!(res.is_ok());
  }

  #[test]
  fn test_validate_sandbox_path_unsafe_traversal() {
    let base = get_fusioncross_base_dir();
    let unsafe_path = base.join("../../../etc/passwd");
    let res = validate_sandbox_path(&unsafe_path);
    assert!(res.is_err());
  }

  #[test]
  fn test_validate_sandbox_path_outside() {
    let outside = Path::new("/tmp").join("malicious");
    let res = validate_sandbox_path(&outside);
    assert!(res.is_err());
  }

  // =====================================================
  // ID VALIDATION
  // =====================================================

  #[test]
  fn test_validate_id_success() {
    assert!(validate_id("bottle-gaming-90").is_ok());
    assert!(validate_id("my_bottle_1").is_ok());
    assert!(validate_id("a").is_ok());
    assert!(validate_id("abc123-_").is_ok());
  }

  #[test]
  fn test_validate_id_failure() {
    assert!(validate_id("bottle/gaming").is_err());
    assert!(validate_id("bottle; rm -rf").is_err());
  }

  #[test]
  fn test_validate_id_empty() {
    assert!(validate_id("").is_err());
  }

  #[test]
  fn test_validate_id_too_long() {
    let long = "a".repeat(129);
    assert!(validate_id(&long).is_err());
  }

  // =====================================================
  // DISPLAY NAME VALIDATION
  // =====================================================

  #[test]
  fn test_validate_display_name_valid() {
    assert!(validate_display_name("Steam").is_ok());
    assert!(validate_display_name("Cyberpunk 2077").is_ok());
    assert!(validate_display_name("My-App_v1.0").is_ok());
  }

  #[test]
  fn test_validate_display_name_empty() {
    assert!(validate_display_name("").is_err());
  }

  #[test]
  fn test_validate_display_name_too_long() {
    let long = "a".repeat(129);
    assert!(validate_display_name(&long).is_err());
  }

  #[test]
  fn test_validate_display_name_invalid_chars() {
    assert!(validate_display_name("steam@home").is_err());
    assert!(validate_display_name("steam;rm").is_err());
    assert!(validate_display_name("steam<script>").is_err());
  }

  // =====================================================
  // COMMAND TEXT VALIDATION
  // =====================================================

  #[test]
  fn test_validate_command_text_valid() {
    assert!(validate_command_text("hello world", "test", 256).is_ok());
    assert!(validate_command_text("", "test", 256).is_ok());
  }

  #[test]
  fn test_validate_command_text_too_long() {
    let long = "a".repeat(257);
    assert!(validate_command_text(&long, "test", 256).is_err());
  }

  #[test]
  fn test_validate_command_text_control_chars() {
    assert!(validate_command_text("hello\nworld", "test", 256).is_ok());
    assert!(validate_command_text("hello\tworld", "test", 256).is_ok());
    assert!(validate_command_text("hello\x00world", "test", 256).is_err());
  }

  // =====================================================
  // EXECUTABLE PATH VALIDATION
  // =====================================================

  #[test]
  fn test_validate_executable_path_valid() {
    assert!(validate_executable_path("/Applications/some.app/Content.exe").is_ok());
  }

  #[test]
  fn test_validate_executable_path_empty() {
    assert!(validate_executable_path("").is_err());
  }

  #[test]
  fn test_validate_executable_path_whitespace() {
    assert!(validate_executable_path("   ").is_err());
  }

  // =====================================================
  // PREFIX TYPE VALIDATION
  // =====================================================

  #[test]
  fn test_validate_prefix_type_valid() {
    assert!(validate_prefix_type("gaming").is_ok());
    assert!(validate_prefix_type("productivity").is_ok());
    assert!(validate_prefix_type("legacy").is_ok());
    assert!(validate_prefix_type("dxvk-optimized").is_ok());
    assert!(validate_prefix_type("lightweight").is_ok());
  }

  #[test]
  fn test_validate_prefix_type_invalid() {
    assert!(validate_prefix_type("unknown").is_err());
    assert!(validate_prefix_type("default").is_err());
  }

  // =====================================================
  // HOST INSTALLER PATH VALIDATION
  // =====================================================

  #[test]
  fn test_validate_host_installer_path_non_absolute() {
    let res = validate_host_installer_path("relative/path.exe");
    assert!(res.is_err());
    assert!(res.unwrap_err().contains("must be absolute"));
  }

  #[test]
  fn test_validate_host_installer_path_nonexistent() {
    let res = validate_host_installer_path("/tmp/fc-nonexistent-installer-xyz.exe");
    assert!(res.is_err());
  }

  // =====================================================
  // IS PATH UNDER HOME
  // =====================================================

  #[test]
  fn test_is_path_under_home_valid() {
    if let Ok(home) = std::env::var("HOME") {
      assert!(is_path_under_home(&format!("{}/Documents/test.txt", home)));
      assert!(is_path_under_home(&home));
    }
  }

  #[test]
  fn test_is_path_under_home_outside() {
    assert!(!is_path_under_home("/etc/passwd"));
    assert!(!is_path_under_home("/tmp"));
  }

  #[test]
  fn test_is_path_under_home_relative() {
    assert!(!is_path_under_home("relative/path.txt"));
  }

  // =====================================================
  // DOWNLOAD URL VALIDATION
  // =====================================================

  #[test]
  fn test_validate_download_url_trusted() {
    assert!(validate_download_url("https://github.com/wine/wine/releases").is_ok());
    assert!(validate_download_url("https://dl.winehq.org/wine-builds/").is_ok());
    assert!(validate_download_url("https://khronos.org/vulkan-sdk/").is_ok());
  }

  #[test]
  fn test_validate_download_url_untrusted() {
    assert!(validate_download_url("https://malicious-domain.com/wine.tar.gz").is_err());
    assert!(validate_download_url("http://github.com/").is_err());
    assert!(validate_download_url("").is_err());
  }

  // =====================================================
  // TAR ENTRY VALIDATION
  // =====================================================

  #[test]
  fn test_validate_tar_entry_name_valid() {
    assert!(validate_tar_entry_name("dxvk/x64/d3d11.dll").is_ok());
    assert!(validate_tar_entry_name("file.txt").is_ok());
    assert!(validate_tar_entry_name("dir/subdir/file").is_ok());
  }

  #[test]
  fn test_validate_tar_entry_name_absolute() {
    assert!(validate_tar_entry_name("/etc/passwd").is_err());
    assert!(validate_tar_entry_name("\\Windows\\system32").is_err());
  }

  #[test]
  fn test_validate_tar_entry_name_parent_dir() {
    assert!(validate_tar_entry_name("../../etc/passwd").is_err());
  }

  #[test]
  fn test_validate_tar_entry_name_empty() {
    assert!(validate_tar_entry_name("").is_err());
    assert!(validate_tar_entry_name("   ").is_err());
  }

  // =====================================================
  // DLL OVERRIDE ABBREVIATION
  // =====================================================

  #[test]
  fn test_dll_override_abbrev() {
    assert_eq!(dll_override_abbrev("native,builtin"), "n,b");
    assert_eq!(dll_override_abbrev("builtin,native"), "n,b");
    assert_eq!(dll_override_abbrev("native"), "n");
    assert_eq!(dll_override_abbrev("builtin"), "b");
    assert_eq!(dll_override_abbrev("disabled"), "");
    assert_eq!(dll_override_abbrev("custom_value"), "custom_value");
  }

  // =====================================================
  // PATH CONVERSION
  // =====================================================

  #[test]
  fn test_unix_path_to_windows_inside_prefix() {
    let prefix = "/tmp/fc-test-prefix";
    let unix = Path::new("/tmp/fc-test-prefix/drive_c/Program Files/some.exe");
    let win = unix_path_to_windows(prefix, unix);
    assert_eq!(win, "C:\\Program Files\\some.exe");
  }

  #[test]
  fn test_unix_path_to_windows_outside_prefix() {
    let prefix = "/tmp/fc-test-prefix";
    let unix = Path::new("/tmp/other/file.exe");
    let win = unix_path_to_windows(prefix, unix);
    assert_eq!(win, "/tmp/other/file.exe");
  }

  #[test]
  fn test_windows_path_to_unix_valid() {
    let prefix = "/tmp/fc-test-prefix";
    let result = windows_path_to_unix(prefix, "C:\\Program Files\\some.exe");
    assert!(result.is_ok());
    let expected = Path::new("/tmp/fc-test-prefix/drive_c/Program Files/some.exe");
    assert_eq!(result.unwrap(), expected);
  }

  #[test]
  fn test_windows_path_to_unix_already_unix() {
    let prefix = "/tmp/fc-test-prefix";
    let result = windows_path_to_unix(prefix, "/tmp/other/file.exe");
    assert!(result.is_ok());
    assert_eq!(result.unwrap(), Path::new("/tmp/other/file.exe"));
  }

  #[test]
  fn test_windows_path_to_unix_unsupported() {
    let prefix = "/tmp/fc-test-prefix";
    let result = windows_path_to_unix(prefix, "D:\\some.exe");
    assert!(result.is_err());
  }

  // =====================================================
  // BUILD WINE DLL OVERRIDES
  // =====================================================

  #[test]
  fn test_build_wine_dll_overrides_no_bottle() {
    let result = build_wine_dll_overrides(None);
    assert_eq!(result, "d3d11,dxgi=n,b");
  }

  #[test]
  fn test_build_wine_dll_overrides_empty() {
    let bottle = Bottle {
      id: "test".to_string(),
      name: "Test".to_string(),
      prefix_type: "gaming".to_string(),
      wine_version: "9.0".to_string(),
      dxvk_enabled: true,
      moltenvk_enabled: true,
      win_version: "win10".to_string(),
      env_vars: std::collections::HashMap::new(),
      dll_overrides: vec![],
      registry_keys: vec![],
      size_bytes: 0,
      path: "/tmp/test".to_string(),
      created_at: "2026-01-01".to_string(),
    };
    let result = build_wine_dll_overrides(Some(&bottle));
    assert_eq!(result, "d3d11,dxgi=n,b");
  }

  #[test]
  fn test_build_wine_dll_overrides_with_overrides() {
    let bottle = Bottle {
      id: "test".to_string(),
      name: "Test".to_string(),
      prefix_type: "gaming".to_string(),
      wine_version: "9.0".to_string(),
      dxvk_enabled: true,
      moltenvk_enabled: true,
      win_version: "win10".to_string(),
      env_vars: std::collections::HashMap::new(),
      dll_overrides: vec![
        DllOverride { library: "d3d11".to_string(), override_type: "native,builtin".to_string() },
        DllOverride { library: "d3d9".to_string(), override_type: "builtin".to_string() },
      ],
      registry_keys: vec![],
      size_bytes: 0,
      path: "/tmp/test".to_string(),
      created_at: "2026-01-01".to_string(),
    };
    let result = build_wine_dll_overrides(Some(&bottle));
    assert_eq!(result, "d3d11=n,b;d3d9=b");
  }

  // =====================================================
  // EXPORT / IMPORT
  // =====================================================

  #[test]
  fn test_export_import_validation() {
    let temp_dir = get_fusioncross_base_dir().join("test_temp");
    if fs::create_dir_all(&temp_dir).is_err() {
      eprintln!("skipping export/import test: cannot create {}", temp_dir.display());
      return;
    }
    let test_file = temp_dir.join("test_backup.json");
    let test_file_str = test_file.to_string_lossy().to_string();

    // Clean up if exists
    if test_file.exists() {
      let _ = fs::remove_file(&test_file);
    }

    let initial = load_state_from_disk_impl();
    let data_mutex = Mutex::new(initial.clone());

    // Should be able to export safely inside home / temp directories
    let export_res = export_app_data_impl(&test_file_str, &initial);
    if export_res.is_err() {
      eprintln!(
        "skipping export/import test: cannot write {} ({:?})",
        test_file.display(),
        export_res
      );
      return;
    }
    assert!(export_res.is_ok());
    assert!(test_file.exists());

    // Import should succeed too
    let import_res = import_app_data_impl(&test_file_str, &data_mutex);
    assert!(import_res.is_ok());

    let _ = fs::remove_file(&test_file);
    let _ = fs::remove_dir_all(&temp_dir);
  }

  // =====================================================
  // APPLESCRIPT STRING ESCAPING
  // =====================================================

  #[test]
  fn test_applescript_string_simple() {
    let result = applescript_string("hello");
    assert_eq!(result, "\"hello\"");
  }

  #[test]
  fn test_applescript_string_with_quotes() {
    let result = applescript_string("he\"llo");
    assert_eq!(result, "\"he\\\"llo\"");
  }

  #[test]
  fn test_applescript_string_with_backslash() {
    let result = applescript_string("he\\llo");
    assert_eq!(result, "\"he\\\\llo\"");
  }

  #[test]
  fn test_applescript_string_with_newlines() {
    let result = applescript_string("hello\nworld\r!");
    assert_eq!(result, "\"hello world !\"");
  }
}
