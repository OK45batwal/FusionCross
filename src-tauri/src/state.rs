// ========================================================
// APPLICATION STATE & DISK PERSISTENCE
// ========================================================

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Arc, Mutex};

use crate::types::*;
use crate::wine::resolve_wine_binary;

// ========================================================
// GLOBAL MUTABLE STATE
// ========================================================

pub struct AppState {
  pub data: Mutex<AppStateData>,
  pub active_process_id: Arc<Mutex<Option<String>>>,
  pub active_child_pid: Arc<Mutex<Option<u32>>>,
}

// ========================================================
// PATH HELPERS
// ========================================================

pub fn user_home_dir() -> Result<PathBuf, String> {
  std::env::var("HOME")
    .map(PathBuf::from)
    .map_err(|_| "HOME environment variable is not set".to_string())
}

/// Base directory where all FusionCross sandboxes are stored.
/// All path validations ensure we never escape this directory.
pub fn get_fusioncross_base_dir() -> PathBuf {
  let home = user_home_dir().unwrap_or_else(|_| std::env::temp_dir());
  home
    .join("Library")
    .join("Application Support")
    .join("FusionCross")
}

pub fn utc_timestamp_now() -> String {
  Command::new("date")
    .args(["-u", "+%Y-%m-%dT%H:%M:%SZ"])
    .output()
    .ok()
    .and_then(|out| {
      if out.status.success() {
        Some(String::from_utf8_lossy(&out.stdout).trim().to_string())
      } else {
        None
      }
    })
    .unwrap_or_else(|| FALLBACK_TIMESTAMP.to_string())
}

/// Helper to resolve the location of the active JSON storage state
pub fn get_state_file_path() -> PathBuf {
  get_fusioncross_base_dir().join("state.json")
}

pub fn new_bottle_id() -> String {
  format!(
    "bottle-{:04x}{:04x}",
    rand::random::<u16>(),
    rand::random::<u16>()
  )
}

const DIR_SIZE_MAX_DEPTH: u32 = 32;
pub const FALLBACK_TIMESTAMP: &str = "1970-01-01T00:00:00Z";

/// Calculate the total size of a directory recursively, with a depth limit.
pub fn calculate_dir_size(path: &Path) -> u64 {
  calculate_dir_size_with_depth(path, 0)
}

fn calculate_dir_size_with_depth(path: &Path, depth: u32) -> u64 {
  if !path.exists() {
    return 0;
  }
  if depth > DIR_SIZE_MAX_DEPTH {
    return 0;
  }
  let mut total: u64 = 0;
  if let Ok(entries) = fs::read_dir(path) {
    for entry in entries.flatten() {
      let meta = entry.metadata();
      if let Ok(m) = meta {
        if m.is_dir() {
          total += calculate_dir_size_with_depth(&entry.path(), depth + 1);
        } else {
          total += m.len();
        }
      }
    }
  }
  total
}

// ========================================================
// DISK PERSISTENCE
// ========================================================

/// Load configuration parameters and saved items from persistent JSON on disk
pub fn load_state_from_disk_impl() -> AppStateData {
  let path = get_state_file_path();
  if path.exists() {
    if let Ok(content) = fs::read_to_string(&path) {
      if let Ok(mut data) = serde_json::from_str::<AppStateData>(&content) {
        // Enforce dynamic home path resolution upon reload so path remains valid if moved
        let base_str = get_fusioncross_base_dir().to_string_lossy().to_string();
        for b in &mut data.bottles {
          if b.path.contains("/fusioncross/bottles") || b.path.contains("/fusionwine/bottles") {
            b.path = format!("{}/bottles/{}", base_str, b.id);
          }
        }
        return data;
      }
    }
  }

  // Fresh install: empty library — CrossOver-style (you install real software into bottles)
  let base = get_fusioncross_base_dir();
  let base_str = base.to_string_lossy().to_string();

  let wine_path = resolve_wine_binary(&AppSettings {
    wine_binary_path: "/opt/homebrew/bin/wine64".to_string(),
    runtime_storage_path: format!("{}/runtimes", base_str),
    sandbox_enabled: true,
    verbose_logs: true,
  })
  .unwrap_or_else(|| "/opt/homebrew/bin/wine64".to_string());

  let default_runtimes = vec![
    Runtime {
      id: "wine-stable".to_string(),
      name: "Wine Stable 9.0".to_string(),
      category: "wine".to_string(),
      version: "9.0.0".to_string(),
      size_bytes: 840_000_000,
      downloaded: true,
      path: format!("{}/runtimes/wine-stable", base_str),
      download_url: "https://dl.winehq.org/wine-builds/macosx/pipeline/wine-stable-9.0.tar.gz".to_string(),
    },
    Runtime {
      id: "proton-ge".to_string(),
      name: "Proton GE 9.0 (Custom Gaming)".to_string(),
      category: "proton".to_string(),
      version: "GE-9.0-1".to_string(),
      size_bytes: 1_280_000_000,
      downloaded: true,
      path: format!("{}/runtimes/proton-ge", base_str),
      download_url: "https://github.com/GloriousEggroll/proton-ge-custom/releases/download/GE-Proton9-1/GE-Proton9-1.tar.gz".to_string(),
    },
    Runtime {
      id: "proton-exp".to_string(),
      name: "Proton Experimental".to_string(),
      category: "proton".to_string(),
      version: "Experimental".to_string(),
      size_bytes: 1_420_000_000,
      downloaded: false,
      path: format!("{}/runtimes/proton-exp", base_str),
      download_url: "https://github.com/GloriousEggroll/proton-ge-custom/releases/download/GE-Proton9-1/GE-Proton9-1.tar.gz".to_string(),
    },
    Runtime {
      id: "dxvk-23".to_string(),
      name: "DXVK Translation Layer v2.3".to_string(),
      category: "dxvk".to_string(),
      version: "2.3.0".to_string(),
      size_bytes: 28_000_000,
      downloaded: true,
      path: format!("{}/runtimes/dxvk-23", base_str),
      download_url: "https://github.com/doitsujin/dxvk/releases/download/v2.3/dxvk-2.3.tar.gz".to_string(),
    },
    Runtime {
      id: "dxvk-latest".to_string(),
      name: "DXVK Master (Nightly Build)".to_string(),
      category: "dxvk".to_string(),
      version: "Git-Nightly".to_string(),
      size_bytes: 31_000_000,
      downloaded: false,
      path: format!("{}/runtimes/dxvk-latest", base_str),
      download_url: "https://github.com/doitsujin/dxvk/releases/latest/download/dxvk.tar.gz".to_string(),
    }
  ];

  let default_settings = AppSettings {
    wine_binary_path: wine_path,
    runtime_storage_path: format!("{}/runtimes", base_str),
    sandbox_enabled: true,
    verbose_logs: true,
  };

  let initial_state = AppStateData {
    bottles: vec![],
    apps: vec![],
    runtimes: default_runtimes,
    settings: default_settings,
    onboarded: false,
  };

  let _ = save_state_to_disk_impl(&initial_state);
  initial_state
}

/// Write state data securely to disk JSON
pub fn save_state_to_disk_impl(data: &AppStateData) -> Result<(), String> {
  let path = get_state_file_path();
  if let Some(parent) = path.parent() {
    let _ = fs::create_dir_all(parent);
  }
  let content = serde_json::to_string_pretty(data).map_err(|e| format!("Serialization error: {}", e))?;
  fs::write(&path, content).map_err(|e| format!("Failed to write state file to disk: {}", e))?;
  Ok(())
}

/// Helper function to perform deep recursive copies inside clone operations
pub fn copy_dir_all(src: impl AsRef<Path>, dst: impl AsRef<Path>) -> Result<(), String> {
  use crate::security::validate_sandbox_path;

  let src = src.as_ref();
  let dst = dst.as_ref();
  validate_sandbox_path(src)?;
  validate_sandbox_path(dst)?;
  fs::create_dir_all(&dst).map_err(|e| format!("Failed to create destination folder: {}", e))?;
  for entry in fs::read_dir(src).map_err(|e| format!("Failed to read source folder: {}", e))? {
    let entry = entry.map_err(|e| format!("Failed directory entry read: {}", e))?;
    let ty = entry.file_type().map_err(|e| format!("Failed to get entry file type: {}", e))?;
    if ty.is_dir() {
      copy_dir_all(entry.path(), dst.join(entry.file_name()))?;
    } else if ty.is_file() {
      fs::copy(entry.path(), dst.join(entry.file_name())).map_err(|e| format!("Failed file copy: {}", e))?;
    }
  }
  Ok(())
}

/// Export state data to a user-chosen file path
pub fn export_app_data_impl(export_path: &str, data: &AppStateData) -> Result<String, String> {
  use crate::security::is_path_under_home;

  let path = Path::new(export_path);
  if !is_path_under_home(export_path) {
    return Err("Security Error: Export backup path must reside inside your user home folder.".to_string());
  }

  let content = serde_json::to_string_pretty(data).map_err(|e| format!("Serialization error: {}", e))?;
  fs::write(path, content).map_err(|e| format!("Failed to write backup file: {}", e))?;

  Ok(format!("Successfully exported database to '{}'.", export_path))
}

/// Import state data from a user-chosen backup file path
pub fn import_app_data_impl(import_path: &str, data_mutex: &Mutex<AppStateData>) -> Result<String, String> {
  use crate::security::is_path_under_home;

  let path = Path::new(import_path);
  if !is_path_under_home(import_path) {
    return Err("Security Error: Import path must reside inside your user home folder.".to_string());
  }
  if !path.exists() {
    return Err("Import path does not exist on disk.".to_string());
  }

  let content = fs::read_to_string(path).map_err(|e| format!("Failed to read backup file: {}", e))?;
  let mut imported_data = serde_json::from_str::<AppStateData>(&content)
    .map_err(|e| format!("Invalid backup file format: {}", e))?;

  // Enforce dynamic home path resolution upon import
  let base_str = get_fusioncross_base_dir().to_string_lossy().to_string();
  for b in &mut imported_data.bottles {
    if b.path.contains("/fusioncross/bottles") || b.path.contains("/fusionwine/bottles") {
      b.path = format!("{}/bottles/{}", base_str, b.id);
    }
  }

  let mut data = data_mutex.lock().map_err(|e| e.to_string())?;
  *data = imported_data;
  save_state_to_disk_impl(&*data)?;

  Ok("Successfully imported database configurations. Refreshing application...".to_string())
}
