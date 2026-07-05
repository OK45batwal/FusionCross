// ========================================================
// DATA STRUCTURES & SERIALIZATION TYPES
// ========================================================

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct DllOverride {
  pub library: String,
  pub override_type: String, // "native", "builtin", "native,builtin", "builtin,native", "disabled"
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct RegistryKey {
  pub path: String,
  pub key: String,
  pub value: String,
  pub value_type: String, // "SZ", "DWORD", "BINARY"
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct Bottle {
  pub id: String,
  pub name: String,
  pub prefix_type: String, // "gaming", "productivity", "legacy", "dxvk-optimized", "lightweight"
  pub wine_version: String,
  pub dxvk_enabled: bool,
  pub moltenvk_enabled: bool,
  pub win_version: String, // "win10", "win11", "win7"
  pub env_vars: HashMap<String, String>,
  pub dll_overrides: Vec<DllOverride>,
  pub registry_keys: Vec<RegistryKey>,
  pub size_bytes: u64,
  pub path: String,
  pub created_at: String,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct AppConfig {
  pub id: String,
  pub name: String,
  pub exe_path: String,
  pub arguments: String,
  pub icon: String,
  pub category: String, // "Games", "Productivity", "Utilities", "Favorites"
  pub tags: Vec<String>,
  pub bottle_id: String,
  pub last_played: Option<String>,
  pub play_time_mins: u32,
  pub favorite: bool,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct Runtime {
  pub id: String,
  pub name: String,
  pub category: String, // "wine", "proton", "dxvk", "moltenvk"
  pub version: String,
  pub size_bytes: u64,
  pub downloaded: bool,
  pub path: String,
  #[serde(default)]
  pub download_url: String,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct SysMetrics {
  pub cpu_usage: f32,
  pub ram_usage_percent: f32,
  pub ram_used_gb: f32,
  pub ram_total_gb: f32,
  pub disk_free_gb: f32,
  pub gpu_usage: f32,
  pub fps: u32,
  pub shader_compilation_percent: u32,
  pub active_pid: u32,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct AppSettings {
  pub wine_binary_path: String,
  pub runtime_storage_path: String,
  pub sandbox_enabled: bool,
  pub verbose_logs: bool,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct AppStateData {
  pub bottles: Vec<Bottle>,
  pub apps: Vec<AppConfig>,
  pub runtimes: Vec<Runtime>,
  pub settings: AppSettings,
  #[serde(default)]
  pub onboarded: bool,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct SessionInfo {
  pub onboarded: bool,
  pub wine_installed: bool,
  pub wine_binary_path: Option<String>,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct InstallResult {
  pub success: bool,
  pub exit_code: i32,
  pub windows_path: String,
  pub message: String,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct SandboxInfo {
  pub bottle_id: String,
  pub prefix_path: String,
  pub drive_c_path: String,
  pub system32_path: String,
  pub program_files_path: String,
  pub registry_files: Vec<String>,
  pub dll_overrides_injected: Vec<String>,
  pub total_files_created: u32,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct DownloadProgress {
  pub id: String,
  pub progress: u32,
  pub status: String,
  pub message: String,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct RosettaStatus {
  pub is_apple_silicon: bool,
  pub is_translated: bool,
  pub rosetta_installed: bool,
  pub wine_installed: bool,
  pub cpu_brand: String,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct DiscoveredApp {
  pub name: String,
  pub path: String,
  pub size_bytes: u64,
}

// ========================================================
// INTERNAL (NON-SERIALIZED) TYPES
// ========================================================

pub enum WineLaunchKind {
  Exe { unix_path: PathBuf },
  Msi { unix_path: PathBuf },
}

pub struct ResolvedLaunch {
  pub kind: WineLaunchKind,
  pub windows_path: String,
}
