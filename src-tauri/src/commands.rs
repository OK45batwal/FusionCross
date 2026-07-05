// ========================================================
// TAURI COMMAND HANDLERS
// ========================================================

use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::Path;
use std::process::{Command, Stdio};

use serde::Serialize;
use sysinfo::{Disks, System};
use tauri::{AppHandle, Emitter, State};

use crate::downloads::{download_wine_engine_impl, trigger_runtime_download_impl};

const BYTES_PER_GB: f64 = 1024.0 * 1024.0 * 1024.0;
use crate::sandbox::{initialize_prefix_sandbox_impl, scan_exes_recursively};
use crate::security::*;
use crate::state::*;
use crate::types::*;
use crate::wine::*;

// ========================================================
// BOTTLE MANAGEMENT
// ========================================================

#[tauri::command]
pub fn list_bottles(state: State<'_, AppState>) -> Result<Vec<Bottle>, String> {
  let data = state.data.lock().map_err(|e| e.to_string())?;
  Ok(data.bottles.clone())
}

#[tauri::command]
pub fn create_bottle(
  name: String,
  prefix_type: String,
  wine_version: String,
  state: State<'_, AppState>,
) -> Result<Bottle, String> {
  validate_display_name(&name)?;
  validate_prefix_type(&prefix_type)?;

  let new_id = new_bottle_id();
  validate_id(&new_id)?;
  let base = get_fusioncross_base_dir();
  let bottle_dir = base.join("bottles").join(&new_id);
  let path = bottle_dir.to_string_lossy().to_string();

  let default_env = HashMap::from([
    ("DXVK_HUD".to_string(), "fps".to_string()),
    ("MVK_CONFIG_FILE".to_string(), format!("{}/mvk.json", path)),
    ("WINEESYNC".to_string(), "1".to_string()),
    ("WINEFSYNC".to_string(), "1".to_string()),
  ]);

  let default_overrides = vec![
    DllOverride { library: "d3d11".to_string(), override_type: "native,builtin".to_string() },
    DllOverride { library: "dxgi".to_string(), override_type: "native,builtin".to_string() },
  ];

  let default_registry = vec![
    RegistryKey {
      path: "HKCU\\Software\\Wine\\Direct3D".to_string(),
      key: "MaxShaderModelVS".to_string(),
      value: "5".to_string(),
      value_type: "DWORD".to_string(),
    },
    RegistryKey {
      path: "HKCU\\Software\\Wine\\Mac Driver".to_string(),
      key: "RetinaMode".to_string(),
      value: "Y".to_string(),
      value_type: "SZ".to_string(),
    }
  ];

  let settings = {
    let data = state.data.lock().map_err(|e| e.to_string())?;
    data.settings.clone()
  };

  let _ = initialize_bottle_prefix(&path, &prefix_type, &settings, None)?;
  let real_size = calculate_dir_size(&bottle_dir);

  let new_bottle = Bottle {
    id: new_id,
    name,
    prefix_type,
    wine_version,
    dxvk_enabled: true,
    moltenvk_enabled: true,
    win_version: "win10".to_string(),
    env_vars: default_env,
    dll_overrides: default_overrides,
    registry_keys: default_registry,
    size_bytes: real_size,
    path,
    created_at: utc_timestamp_now()
      .split('T')
      .next()
      .unwrap_or("2026-01-01")
      .to_string(),
  };

  let mut data = state.data.lock().map_err(|e| e.to_string())?;
  data.bottles.push(new_bottle.clone());
  save_state_to_disk_impl(&*data)?;

  Ok(new_bottle)
}

#[tauri::command]
pub fn delete_bottle(id: String, state: State<'_, AppState>) -> Result<String, String> {
  validate_id(&id)?;

  let mut data = state.data.lock().map_err(|e| e.to_string())?;
  let index = data.bottles.iter().position(|b| b.id == id)
    .ok_or_else(|| "Bottle not found".to_string())?;

  // Clean up prefix directory if it exists and is within the sandbox
  let bottle_path = data.bottles[index].path.clone();
  let path = Path::new(&bottle_path);
  if path.exists() {
    match validate_sandbox_path(path) {
      Ok(_) => {
        let _ = fs::remove_dir_all(path);
      }
      Err(e) => {
        eprintln!("[FusionCross] Skipping directory cleanup for '{}': {}", bottle_path, e);
      }
    }
  }

  data.bottles.remove(index);
  data.apps.retain(|a| a.bottle_id != id);
  save_state_to_disk_impl(&*data)?;

  Ok(id)
}

#[tauri::command]
pub fn clone_bottle(id: String, target_name: String, state: State<'_, AppState>) -> Result<Bottle, String> {
  validate_id(&id)?;
  validate_display_name(&target_name)?;

  let mut data = state.data.lock().map_err(|e| e.to_string())?;
  let index = data.bottles.iter().position(|b| b.id == id)
    .ok_or_else(|| "Bottle not found".to_string())?;

  let source = &data.bottles[index];
  let clone_id = new_bottle_id();
  let base = get_fusioncross_base_dir();
  let clone_dir = base.join("bottles").join(&clone_id);
  validate_sandbox_path(&clone_dir)?;
  let clone_path_str = clone_dir.to_string_lossy().to_string();

  // Recursively copy prefix content
  let src_path = Path::new(&source.path);
  if src_path.exists() {
    copy_dir_all(src_path, &clone_dir)?;
  } else {
    initialize_prefix_sandbox_impl(&clone_path_str, &source.prefix_type)?;
  }

  let real_size = calculate_dir_size(&clone_dir);

  let cloned = Bottle {
    id: clone_id.clone(),
    name: target_name,
    prefix_type: source.prefix_type.clone(),
    wine_version: source.wine_version.clone(),
    dxvk_enabled: source.dxvk_enabled,
    moltenvk_enabled: source.moltenvk_enabled,
    win_version: source.win_version.clone(),
    env_vars: source.env_vars.clone(),
    dll_overrides: source.dll_overrides.clone(),
    registry_keys: source.registry_keys.clone(),
    size_bytes: real_size,
    path: clone_path_str,
    created_at: utc_timestamp_now()
      .split('T')
      .next()
      .unwrap_or("2026-01-01")
      .to_string(),
  };

  data.bottles.push(cloned.clone());
  save_state_to_disk_impl(&*data)?;

  Ok(cloned)
}

#[tauri::command]
pub fn update_bottle_settings(
  id: String,
  win_version: String,
  dxvk_enabled: bool,
  moltenvk_enabled: bool,
  dll_overrides: Vec<DllOverride>,
  env_vars: HashMap<String, String>,
  registry_keys: Vec<RegistryKey>,
  state: State<'_, AppState>,
) -> Result<Bottle, String> {
  validate_id(&id)?;

  let mut data = state.data.lock().map_err(|e| e.to_string())?;
  let index = data.bottles.iter().position(|b| b.id == id)
    .ok_or_else(|| "Bottle not found".to_string())?;

  data.bottles[index].win_version = win_version;
  data.bottles[index].dxvk_enabled = dxvk_enabled;
  data.bottles[index].moltenvk_enabled = moltenvk_enabled;
  data.bottles[index].dll_overrides = dll_overrides;
  data.bottles[index].env_vars = env_vars;
  data.bottles[index].registry_keys = registry_keys;

  let bottle_clone = data.bottles[index].clone();
  save_state_to_disk_impl(&*data)?;
  Ok(bottle_clone)
}

// ========================================================
// SETTINGS
// ========================================================

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
  let data = state.data.lock().map_err(|e| e.to_string())?;
  Ok(data.settings.clone())
}

#[tauri::command]
pub fn update_settings(
  wine_binary_path: Option<String>,
  runtime_storage_path: Option<String>,
  sandbox_enabled: Option<bool>,
  verbose_logs: Option<bool>,
  state: State<'_, AppState>,
) -> Result<AppSettings, String> {
  let mut data = state.data.lock().map_err(|e| e.to_string())?;

  if let Some(path) = wine_binary_path {
    if !path.is_empty() && !Path::new(&path).exists() {
      return Err(format!("Wine binary not found at '{}'.", path));
    }
    data.settings.wine_binary_path = path;
  }
  if let Some(path) = runtime_storage_path {
    validate_sandbox_path(Path::new(&path))?;
    data.settings.runtime_storage_path = path;
  }
  if let Some(enabled) = sandbox_enabled {
    data.settings.sandbox_enabled = enabled;
  }
  if let Some(verbose) = verbose_logs {
    data.settings.verbose_logs = verbose;
  }

  let settings = data.settings.clone();
  save_state_to_disk_impl(&*data)?;
  Ok(settings)
}

// ========================================================
// APP MANAGEMENT
// ========================================================

#[tauri::command]
pub fn list_apps(state: State<'_, AppState>) -> Result<Vec<AppConfig>, String> {
  let data = state.data.lock().map_err(|e| e.to_string())?;
  Ok(data.apps.clone())
}

#[tauri::command]
pub fn register_app(
  name: String,
  exe_path: String,
  arguments: String,
  bottle_id: String,
  category: String,
  tags: Vec<String>,
  state: State<'_, AppState>,
) -> Result<AppConfig, String> {
  validate_id(&bottle_id)?;
  validate_display_name(&name)?;
  validate_executable_path(&exe_path)?;
  validate_command_text(&arguments, "Arguments", 2048)?;
  validate_command_text(&category, "Category", 64)?;

  let app_id = format!("app-{}", rand::random::<u16>());
  let icon = match name.to_lowercase() {
    n if n.contains("steam") => "steam".to_string(),
    n if n.contains("cyberpunk") => "cyberpunk".to_string(),
    n if n.contains("witcher") => "witcher".to_string(),
    n if n.contains("office") => "office".to_string(),
    n if n.contains("photoshop") => "photoshop".to_string(),
    _ => "generic".to_string(),
  };

  let new_app = AppConfig {
    id: app_id,
    name,
    exe_path,
    arguments,
    icon,
    category,
    tags,
    bottle_id: bottle_id.clone(),
    last_played: None,
    play_time_mins: 0,
    favorite: false,
  };

  let mut data = state.data.lock().map_err(|e| e.to_string())?;
  if !data.bottles.iter().any(|b| b.id == bottle_id) {
    return Err(format!("Bottle '{}' not found.", bottle_id));
  }
  data.apps.push(new_app.clone());
  save_state_to_disk_impl(&*data)?;

  Ok(new_app)
}

#[tauri::command]
pub fn toggle_favorite(id: String, state: State<'_, AppState>) -> Result<AppConfig, String> {
  let mut data = state.data.lock().map_err(|e| e.to_string())?;
  let index = data.apps.iter().position(|a| a.id == id)
    .ok_or_else(|| "App not found".to_string())?;

  data.apps[index].favorite = !data.apps[index].favorite;
  let app_clone = data.apps[index].clone();
  save_state_to_disk_impl(&*data)?;

  Ok(app_clone)
}

#[tauri::command]
pub fn run_app(id: String, state: State<'_, AppState>, app_handle: AppHandle) -> Result<String, String> {
  validate_id(&id)?;

  let launch = {
    let mut data = state.data.lock().map_err(|e| e.to_string())?;
    let index = data
      .apps
      .iter()
      .position(|a| a.id == id)
      .ok_or_else(|| "App not found".to_string())?;

    data.apps[index].last_played = Some(utc_timestamp_now());
    data.apps[index].play_time_mins = data.apps[index].play_time_mins.saturating_add(1);

    let app_name = data.apps[index].name.clone();
    let exe_path = data.apps[index].exe_path.clone();
    let arguments = data.apps[index].arguments.clone();
    let bottle_id = data.apps[index].bottle_id.clone();
    let settings = data.settings.clone();

    let bottle = data
      .bottles
      .iter()
      .find(|b| b.id == bottle_id)
      .ok_or_else(|| format!("Bottle '{}' not found for this app", bottle_id))?
      .clone();

    save_state_to_disk_impl(&*data)?;

    (
      app_name,
      bottle.path.clone(),
      exe_path,
      arguments,
      bottle,
      settings,
    )
  };

  let (app_name, prefix_path, exe_path, arguments, bottle, settings) = launch;
  validate_sandbox_path(Path::new(&prefix_path))?;

  {
    let mut active = state.active_process_id.lock().map_err(|e| e.to_string())?;
    *active = Some(id);
  }

  spawn_wine_process(
    prefix_path,
    exe_path,
    arguments,
    settings,
    Some(bottle),
    app_handle,
    state.active_child_pid.clone(),
    state.active_process_id.clone(),
    true,
  );

  Ok(app_name)
}

#[tauri::command]
pub fn stop_active_app(state: State<'_, AppState>) -> Result<bool, String> {
  let mut active = state.active_process_id.lock().map_err(|e| e.to_string())?;
  *active = None;

  let mut pid_guard = state.active_child_pid.lock().map_err(|e| e.to_string())?;
  if let Some(pid) = *pid_guard {
    let _ = Command::new("kill").arg("-TERM").arg(pid.to_string()).status();
    *pid_guard = None;
    Ok(true)
  } else {
    Ok(false)
  }
}

// ========================================================
// SESSION & ONBOARDING
// ========================================================

#[tauri::command]
pub fn get_session(state: State<'_, AppState>) -> Result<SessionInfo, String> {
  let data = state.data.lock().map_err(|e| e.to_string())?;
  let wine_binary_path = resolve_wine_binary(&data.settings);
  Ok(SessionInfo {
    onboarded: data.onboarded,
    wine_installed: wine_binary_path.is_some(),
    wine_binary_path,
  })
}

#[tauri::command]
pub fn complete_onboarding(state: State<'_, AppState>) -> Result<bool, String> {
  let mut data = state.data.lock().map_err(|e| e.to_string())?;
  data.onboarded = true;
  save_state_to_disk_impl(&*data)?;
  Ok(true)
}

// ========================================================
// WINE INSTALL & EXECUTION
// ========================================================

#[tauri::command]
pub fn install_windows_software(
  prefix_path: String,
  installer_path: String,
  arguments: String,
  app_handle: AppHandle,
  state: State<'_, AppState>,
) -> Result<InstallResult, String> {
  validate_sandbox_path(Path::new(&prefix_path))?;
  validate_command_text(&installer_path, "Installer path", 4096)?;
  validate_command_text(&arguments, "Arguments", 2048)?;

  let (settings, bottle) = {
    let data = state.data.lock().map_err(|e| e.to_string())?;
    let bottle = data
      .bottles
      .iter()
      .find(|b| b.path == prefix_path)
      .cloned();
    (data.settings.clone(), bottle)
  };

  let launch = resolve_launch_target(&prefix_path, &installer_path)?;
  let result = run_wine_launch(
    &prefix_path,
    launch,
    arguments,
    settings,
    bottle,
    &app_handle,
    state.active_child_pid.clone(),
    true,
    false,
  )?;

  if let Ok(mut data) = state.data.lock() {
    if let Some(index) = data.bottles.iter().position(|b| b.path == prefix_path) {
      data.bottles[index].size_bytes = calculate_dir_size(Path::new(&prefix_path));
      let _ = save_state_to_disk_impl(&*data);
    }
  }

  Ok(result)
}

#[tauri::command]
pub fn execute_windows_binary(
  prefix_path: String,
  exe_path: String,
  arguments: String,
  app_handle: AppHandle,
  state: State<'_, AppState>,
) -> Result<String, String> {
  validate_sandbox_path(Path::new(&prefix_path))?;
  validate_command_text(&arguments, "Arguments", 2048)?;

  let (settings, bottle) = {
    let data = state.data.lock().map_err(|e| e.to_string())?;
    let bottle = data
      .bottles
      .iter()
      .find(|b| b.path == prefix_path)
      .cloned();
    (data.settings.clone(), bottle)
  };

  if resolve_wine_binary(&settings).is_none() {
    return Err(
      "Wine is not installed. Install with: brew install --cask wine-stable".to_string(),
    );
  }

  spawn_wine_process(
    prefix_path.clone(),
    exe_path.clone(),
    arguments,
    settings,
    bottle,
    app_handle,
    state.active_child_pid.clone(),
    state.active_process_id.clone(),
    false,
  );

  Ok(format!("Launching via Wine: {}", exe_path))
}

// ========================================================
// RUNTIMES & DOWNLOADS
// ========================================================

#[tauri::command]
pub fn list_runtimes(state: State<'_, AppState>) -> Result<Vec<Runtime>, String> {
  let data = state.data.lock().map_err(|e| e.to_string())?;
  Ok(data.runtimes.clone())
}

#[tauri::command]
pub fn mark_runtime_downloaded(id: String, state: State<'_, AppState>) -> Result<String, String> {
  validate_id(&id)?;
  let mut data = state.data.lock().map_err(|e| e.to_string())?;
  if let Some(index) = data.runtimes.iter().position(|r| r.id == id) {
    data.runtimes[index].downloaded = true;
    save_state_to_disk_impl(&*data)?;
    Ok(id)
  } else {
    Err("Runtime not found".to_string())
  }
}

#[tauri::command]
pub fn trigger_runtime_download(id: String, state: State<'_, AppState>, app_handle: AppHandle) -> Result<String, String> {
  validate_id(&id)?;

  let (r_name, download_url) = {
    let data = state.data.lock().map_err(|e| e.to_string())?;
    let index = data.runtimes.iter().position(|r| r.id == id)
      .ok_or_else(|| "Runtime not found".to_string())?;

    if data.runtimes[index].downloaded {
      return Ok(id);
    }
    let name = data.runtimes[index].name.clone();
    let url = data.runtimes[index].download_url.clone();
    (name, url)
  };

  if download_url.is_empty() {
    return Err(format!("No download URL configured for runtime '{}'.", id));
  }

  trigger_runtime_download_impl(id, download_url, app_handle);

  Ok(r_name)
}

#[tauri::command]
pub fn download_wine_engine(
  engine_url: String,
  target_id: String,
  app_handle: AppHandle,
) -> Result<String, String> {
  download_wine_engine_impl(engine_url, target_id, app_handle)
}

// ========================================================
// SYSTEM METRICS
// ========================================================

#[tauri::command]
pub fn get_system_metrics(state: State<'_, AppState>) -> Result<SysMetrics, String> {
  let active_pid = state.active_child_pid.lock()
    .map(|pid| pid.unwrap_or(0))
    .unwrap_or(0);

  let mut system = System::new_all();
  system.refresh_cpu();
  system.refresh_memory();

  let cpu_usage = {
    let cpus = system.cpus();
    if cpus.is_empty() {
      0.0
    } else {
      cpus.iter().map(|cpu| cpu.cpu_usage()).sum::<f32>() / cpus.len() as f32
    }
  };

  let total_memory = system.total_memory() as f64;
  let used_memory = system.used_memory() as f64;
  let ram_total_gb = (total_memory / BYTES_PER_GB) as f32;
  let ram_used_gb = (used_memory / BYTES_PER_GB) as f32;
  let ram_usage_percent = if total_memory > 0.0 {
    ((used_memory / total_memory) * 100.0) as f32
  } else {
    0.0
  };

  let disks = Disks::new_with_refreshed_list();
  let disk_free_gb = disks
    .list()
    .iter()
    .find(|disk| disk.mount_point() == Path::new("/"))
    .or_else(|| disks.list().first())
    .map(|disk| (disk.available_space() as f64) / BYTES_PER_GB)
    .unwrap_or(0.0) as f32;

  Ok(SysMetrics {
    cpu_usage,
    ram_usage_percent,
    ram_used_gb,
    ram_total_gb,
    disk_free_gb,
    gpu_usage: 0.0,
    fps: 0,
    shader_compilation_percent: 0,
    active_pid,
  })
}

// ========================================================
// SANDBOX COMMANDS
// ========================================================

#[tauri::command]
pub fn initialize_prefix_sandbox(bottle_id: String, prefix_path: String, prefix_type: String) -> Result<SandboxInfo, String> {
  validate_id(&bottle_id)?;
  let info = initialize_prefix_sandbox_impl(&prefix_path, &prefix_type)?;
  let mut info = info;
  info.bottle_id = bottle_id;
  Ok(info)
}

#[tauri::command]
pub fn reset_sandbox(
  bottle_id: String,
  prefix_path: String,
  state: State<'_, AppState>,
) -> Result<String, String> {
  validate_id(&bottle_id)?;
  let path = Path::new(&prefix_path);
  validate_sandbox_path(path)?;

  if path.exists() {
    fs::remove_dir_all(path).map_err(|e| format!("Failed to remove sandbox: {}", e))?;
  }
  let settings = {
    let data = state.data.lock().map_err(|e| e.to_string())?;
    data.settings.clone()
  };
  let _ = initialize_bottle_prefix(&prefix_path, "gaming", &settings, None)?;

  Ok(format!("Sandbox '{}' has been reset successfully", bottle_id))
}

#[tauri::command]
pub fn open_prefix_in_finder(prefix_path: String) -> Result<bool, String> {
  let path = Path::new(&prefix_path);
  validate_sandbox_path(path)?;

  if !path.exists() {
    return Err(format!("Path does not exist: {}", prefix_path));
  }

  Command::new("open")
    .arg(&prefix_path)
    .spawn()
    .map_err(|e| format!("Failed to open Finder: {}", e))?;

  Ok(true)
}

// ========================================================
// DIAGNOSTICS & ROSETTA
// ========================================================

#[tauri::command]
pub fn check_rosetta_status() -> Result<RosettaStatus, String> {
  let mut is_apple_silicon = false;
  let mut is_translated = false;
  let mut rosetta_installed = false;
  let mut wine_installed = false;
  let mut cpu_brand = "Intel Core Processor".to_string();

  // 1. Check if running on ARM64 macOS (Apple Silicon)
  let output = Command::new("sysctl")
    .arg("-n")
    .arg("hw.optional.arm64")
    .output();
  if let Ok(out) = output {
    let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if s == "1" {
      is_apple_silicon = true;
      cpu_brand = "Apple M-Series Silicon (ARM64)".to_string();
    }
  }

  // 2. Check if process is translated (Rosetta 2 translation active)
  let output = Command::new("sysctl")
    .arg("-n")
    .arg("sysctl.proc_translated")
    .output();
  if let Ok(out) = output {
    let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if s == "1" {
      is_translated = true;
    }
  }

  // 3. Check if Rosetta is installed / operational
  let rosetta_paths = [
    "/Library/Apple/usr/libexec/oah/translate",
    "/usr/libexec/oah/translate",
  ];
  for path in &rosetta_paths {
    if Path::new(path).exists() {
      rosetta_installed = true;
      break;
    }
  }
  if is_apple_silicon && !rosetta_installed {
    let pgrep = Command::new("pgrep").arg("oahd").output();
    if let Ok(pgrep_out) = pgrep {
      if pgrep_out.status.success() {
        rosetta_installed = true;
      }
    }
  }

  // 4. Validate if wine is installed
  let wine_candidates = [
    "/usr/local/bin/wine64",
    "/opt/homebrew/bin/wine64",
  ];
  for candidate in &wine_candidates {
    if Path::new(candidate).exists() {
      wine_installed = true;
      break;
    }
  }

  Ok(RosettaStatus {
    is_apple_silicon,
    is_translated,
    rosetta_installed: rosetta_installed || is_translated,
    wine_installed,
    cpu_brand,
  })
}

// ========================================================
// DEPENDENCIES & DXVK
// ========================================================

#[tauri::command]
pub fn install_dependencies(
  bottle_id: String,
  dependency: String,
  app_handle: AppHandle,
  state: State<'_, AppState>,
) -> Result<String, String> {
  validate_id(&bottle_id)?;
  validate_command_text(&dependency, "Dependency verb", 128)?;

  let (bottle_name, prefix_path, settings) = {
    let data = state.data.lock().map_err(|e| e.to_string())?;
    let index = data.bottles.iter().position(|b| b.id == bottle_id)
      .ok_or_else(|| "Bottle not found".to_string())?;

    (
      data.bottles[index].name.clone(),
      data.bottles[index].path.clone(),
      data.settings.clone(),
    )
  };

  let dep_clone = dependency.clone();
  let app_handle_clone = app_handle.clone();

  spawn_fallible("install-deps", move || {
    #[derive(Serialize, Clone)]
    struct DepProgress {
      id: String,
      progress: u32,
    }

    let _ = app_handle_clone.emit(
      "wine-log-stream",
      format!("[Winetricks] Resolving dependency '{}' for '{}'.", dep_clone, bottle_name),
    );

    let Some(wine_bin) = resolve_wine_binary(&settings) else {
      let _ = app_handle_clone.emit(
        "wine-log-stream",
        "[FusionCross:Error] Wine is not installed. Cannot run winetricks.".to_string(),
      );
      return;
    };

    let Some(winetricks_bin) = resolve_winetricks_binary() else {
      let _ = app_handle_clone.emit(
        "wine-log-stream",
        "[FusionCross:Error] Winetricks is not installed. Install with: brew install winetricks".to_string(),
      );
      return;
    };

    let _ = app_handle_clone.emit(
      "download-progress",
      DepProgress { id: format!("dep-{}", dep_clone), progress: 10 },
    );
    let _ = app_handle_clone.emit(
      "wine-log-stream",
      format!("[Winetricks] WINEPREFIX={}", prefix_path),
    );

    let output = Command::new(winetricks_bin)
      .env("WINEPREFIX", &prefix_path)
      .env("WINE", &wine_bin)
      .arg("-q")
      .arg(&dep_clone)
      .output();

    match output {
      Ok(out) => {
        let _ = app_handle_clone.emit(
          "download-progress",
          DepProgress { id: format!("dep-{}", dep_clone), progress: 90 },
        );

        for line in String::from_utf8_lossy(&out.stdout).lines() {
          let _ = app_handle_clone.emit("wine-log-stream", format!("[Winetricks] {}", line));
        }
        for line in String::from_utf8_lossy(&out.stderr).lines() {
          let _ = app_handle_clone.emit("wine-log-stream", format!("[Winetricks] {}", line));
        }

        let status_line = if out.status.success() {
          format!(
            "[Winetricks] Successfully installed '{}' into bottle '{}'.",
            dep_clone, bottle_name
          )
        } else {
          format!(
            "[Winetricks:Error] Dependency '{}' failed with status {}.",
            dep_clone, out.status
          )
        };
        let _ = app_handle_clone.emit("wine-log-stream", status_line);
        let _ = app_handle_clone.emit(
          "download-progress",
          DepProgress {
            id: format!("dep-{}", dep_clone),
            progress: if out.status.success() { 100 } else { 0 },
          },
        );
      }
      Err(err) => {
        let _ = app_handle_clone.emit(
          "wine-log-stream",
          format!("[Winetricks:Error] Failed to execute winetricks: {}", err),
        );
        let _ = app_handle_clone.emit(
          "download-progress",
          DepProgress { id: format!("dep-{}", dep_clone), progress: 0 },
        );
      }
    }
  });

  Ok(format!("Dependency installation started for '{}'", dependency))
}

#[tauri::command]
pub fn install_dxvk(
  bottle_id: String,
  version: String,
  app_handle: AppHandle,
  state: State<'_, AppState>,
) -> Result<String, String> {
  validate_id(&bottle_id)?;

  let prefix_path = {
    let mut data = state.data.lock().map_err(|e| e.to_string())?;
    let index = data.bottles.iter().position(|b| b.id == bottle_id)
      .ok_or_else(|| "Bottle not found".to_string())?;

    data.bottles[index].dxvk_enabled = true;
    data.bottles[index].moltenvk_enabled = true;

    let has_d3d11 = data.bottles[index].dll_overrides.iter().any(|o| o.library == "d3d11");
    if !has_d3d11 {
      data.bottles[index].dll_overrides.push(DllOverride {
        library: "d3d11".to_string(),
        override_type: "native,builtin".to_string(),
      });
    }
    let has_dxgi = data.bottles[index].dll_overrides.iter().any(|o| o.library == "dxgi");
    if !has_dxgi {
      data.bottles[index].dll_overrides.push(DllOverride {
        library: "dxgi".to_string(),
        override_type: "native,builtin".to_string(),
      });
    }

    save_state_to_disk_impl(&*data)?;
    data.bottles[index].path.clone()
  };

  let app_handle_clone = app_handle.clone();
  let version_clone = version.clone();
  let prefix_path_clone = prefix_path.clone();

  spawn_fallible("install-dxvk", move || {
    let _ = app_handle_clone.emit("wine-log-stream", format!(
      "[FusionCross] Downloading DXVK v{} from GitHub...", version_clone
    ));

    let download_url = format!(
      "https://github.com/doitsujin/dxvk/releases/download/v{}/dxvk-{}.tar.gz",
      version_clone, version_clone
    );

    let base = crate::state::get_fusioncross_base_dir();
    let temp_dir = base.join("tmp").join(format!("dxvk-{}", version_clone));
    let _ = fs::create_dir_all(&temp_dir);
    let archive_path = temp_dir.join("dxvk.tar.gz");

    let curl_result = Command::new("curl")
      .args(["-L", "-o"])
      .arg(archive_path.to_string_lossy().as_ref())
      .arg(&download_url)
      .arg("--progress-bar")
      .stdout(Stdio::piped())
      .stderr(Stdio::piped())
      .output();

    match curl_result {
      Ok(output) if output.status.success() => {
        let _ = app_handle_clone.emit("wine-log-stream",
          "[FusionCross] DXVK downloaded. Validating archive safety...".to_string());

        if let Err(err) = crate::security::validate_tar_archive_for_safe_extract(&archive_path) {
          let _ = app_handle_clone.emit("wine-log-stream",
            format!("[FusionCross:Error] Unsafe archive rejected: {}", err));
          let _ = fs::remove_file(&archive_path);
          let _ = fs::remove_dir_all(&temp_dir);
          return;
        }

        let _ = app_handle_clone.emit("wine-log-stream",
          "[FusionCross] Extracting DXVK DLLs...".to_string());

        let extract_dir = temp_dir.join("extracted");
        let _ = fs::create_dir_all(&extract_dir);

        let tar_result = Command::new("tar")
          .args(["-xzf"])
          .arg(archive_path.to_string_lossy().as_ref())
          .arg("-C")
          .arg(extract_dir.to_string_lossy().as_ref())
          .output();

        match tar_result {
          Ok(tar_out) if tar_out.status.success() => {
            let _ = fs::remove_file(&archive_path);

            let base_path = Path::new(&prefix_path_clone);
            let system32 = base_path.join("drive_c").join("windows").join("system32");
            let syswow64 = base_path.join("drive_c").join("windows").join("syswow64");

            let dxvk_extracted = extract_dir.join(format!("dxvk-{}", version_clone));

            let mut copied_count = 0u32;

            // Copy x64 DLLs to system32
            let x64_dir = dxvk_extracted.join("x64");
            if x64_dir.exists() {
              if let Ok(entries) = fs::read_dir(&x64_dir) {
                for entry in entries.flatten() {
                  let path = entry.path();
                  if path.extension().and_then(|e| e.to_str()) == Some("dll") {
                    let dest = system32.join(path.file_name().unwrap());
                    let _ = fs::copy(&path, &dest);
                    copied_count += 1;
                  }
                }
              }
            }

            // Copy x32 DLLs to syswow64 if it exists
            let x32_dir = dxvk_extracted.join("x32");
            if x32_dir.exists() && syswow64.exists() {
              if let Ok(entries) = fs::read_dir(&x32_dir) {
                for entry in entries.flatten() {
                  let path = entry.path();
                  if path.extension().and_then(|e| e.to_str()) == Some("dll") {
                    let dest = syswow64.join(path.file_name().unwrap());
                    let _ = fs::copy(&path, &dest);
                    copied_count += 1;
                  }
                }
              }
            }

            // Clean up extraction
            let _ = fs::remove_dir_all(&temp_dir);

            let _ = app_handle_clone.emit("wine-log-stream", format!(
              "[DXVK] Installed {} DLLs into prefix (v{})", copied_count, version_clone
            ));
          }
          Ok(tar_out) => {
            let err = String::from_utf8_lossy(&tar_out.stderr);
            let _ = app_handle_clone.emit("wine-log-stream",
              format!("[FusionCross:Error] Extraction failed: {}", err));
          }
          Err(e) => {
            let _ = app_handle_clone.emit("wine-log-stream",
              format!("[FusionCross:Error] Failed to run tar: {}", e));
          }
        }
      }
      Ok(output) => {
        let err = String::from_utf8_lossy(&output.stderr);
        let _ = app_handle_clone.emit("wine-log-stream",
          format!("[FusionCross:Error] Download failed: {}", err));
      }
      Err(e) => {
        let _ = app_handle_clone.emit("wine-log-stream",
          format!("[FusionCross:Error] Failed to start curl: {}", e));
      }
    }
  });

  Ok(format!("DXVK version {} install started.", version))
}

// ========================================================
// BACKUP, SCAN, EXPORT, IMPORT
// ========================================================

#[tauri::command]
pub fn backup_bottle(
  bottle_id: String,
  backup_path: String,
  state: State<'_, AppState>,
) -> Result<String, String> {
  validate_id(&bottle_id)?;

  let prefix_path = {
    let data = state.data.lock().map_err(|e| e.to_string())?;
    let index = data.bottles.iter().position(|b| b.id == bottle_id)
      .ok_or_else(|| "Bottle not found".to_string())?;
    data.bottles[index].path.clone()
  };

  let source_path = Path::new(&prefix_path);
  if !source_path.exists() {
    return Err("Bottle sandbox directory does not exist on disk.".to_string());
  }

  validate_sandbox_path(source_path)?;
  let target_archive = Path::new(&backup_path);

  let status = Command::new("tar")
    .arg("-czf")
    .arg(target_archive)
    .arg("-C")
    .arg(source_path.parent().unwrap())
    .arg(source_path.file_name().unwrap())
    .status()
    .map_err(|e| format!("Failed to run tar command: {}", e))?;

  if status.success() {
    Ok(format!("Successfully backed up bottle '{}' to archive '{}'.", bottle_id, backup_path))
  } else {
    Err("Tar compression command failed during execution.".to_string())
  }
}

#[tauri::command]
pub fn scan_apps(bottle_id: String, state: State<'_, AppState>) -> Result<Vec<DiscoveredApp>, String> {
  validate_id(&bottle_id)?;

  let prefix_path = {
    let data = state.data.lock().map_err(|e| e.to_string())?;
    let index = data.bottles.iter().position(|b| b.id == bottle_id)
      .ok_or_else(|| "Bottle not found".to_string())?;
    data.bottles[index].path.clone()
  };

  let base_path = Path::new(&prefix_path);
  let drive_c = base_path.join("drive_c");

  if !drive_c.exists() {
    return Ok(vec![]);
  }

  let mut discovered = Vec::new();
  let search_folders = [
    drive_c.join("Program Files"),
    drive_c.join("Program Files (x86)"),
  ];

  for folder in &search_folders {
    if folder.exists() {
      scan_exes_recursively(&drive_c, folder, &mut discovered);
    }
  }

  discovered.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
  Ok(discovered)
}

#[tauri::command]
pub fn export_logs(logs: Vec<String>, export_path: String) -> Result<String, String> {
  let file_path = Path::new(&export_path);

  if !is_path_under_home(&export_path) {
    return Err("Security Error: Export log path must reside inside your user home folder.".to_string());
  }

  let mut file = fs::File::create(file_path).map_err(|e| format!("Failed to create export log file: {}", e))?;
  for line in logs {
    writeln!(file, "{}", line).map_err(|e| format!("Failed to write log line: {}", e))?;
  }

  Ok(format!("Successfully exported diagnostic logs to '{}'.", export_path))
}

#[tauri::command]
pub fn export_app_data(export_path: String, state: State<'_, AppState>) -> Result<String, String> {
  let data = state.data.lock().map_err(|e| e.to_string())?;
  export_app_data_impl(&export_path, &*data)
}

#[tauri::command]
pub fn import_app_data(import_path: String, state: State<'_, AppState>) -> Result<String, String> {
  import_app_data_impl(&import_path, &state.data)
}

// ========================================================
// NATIVE APPLESCRIPT DIALOG PICKERS
// ========================================================

#[tauri::command]
pub fn open_file_picker(title: String, file_types: Vec<String>) -> Result<String, String> {
  let types_str = if file_types.is_empty() {
    "".to_string()
  } else {
    let items: Vec<String> = file_types.iter().map(|t| applescript_string(t)).collect();
    format!(" of type {{{}}}", items.join(", "))
  };

  let script = format!(
    "POSIX path of (choose file{} with prompt {})",
    types_str,
    applescript_string(&title)
  );

  let output = Command::new("osascript")
    .arg("-e")
    .arg(&script)
    .output();

  match output {
    Ok(out) => {
      if out.status.success() {
        let path = String::from_utf8_lossy(&out.stdout).trim().to_string();
        Ok(path)
      } else {
        Ok("".to_string())
      }
    }
    Err(e) => Err(format!("Failed to execute AppleScript file picker: {}", e)),
  }
}

#[tauri::command]
pub fn open_folder_picker(title: String) -> Result<String, String> {
  let script = format!(
    "POSIX path of (choose folder with prompt {})",
    applescript_string(&title)
  );

  let output = Command::new("osascript")
    .arg("-e")
    .arg(&script)
    .output();

  match output {
    Ok(out) => {
      if out.status.success() {
        let path = String::from_utf8_lossy(&out.stdout).trim().to_string();
        Ok(path)
      } else {
        Ok("".to_string())
      }
    }
    Err(e) => Err(format!("Failed to execute AppleScript folder picker: {}", e)),
  }
}

#[tauri::command]
pub fn save_file_picker(title: String, default_name: String) -> Result<String, String> {
  let script = format!(
    "POSIX path of (choose file name with prompt {} default name {})",
    applescript_string(&title),
    applescript_string(&default_name)
  );

  let output = Command::new("osascript")
    .arg("-e")
    .arg(&script)
    .output();

  match output {
    Ok(out) => {
      if out.status.success() {
        let path = String::from_utf8_lossy(&out.stdout).trim().to_string();
        Ok(path)
      } else {
        Ok("".to_string())
      }
    }
    Err(e) => Err(format!("Failed to execute AppleScript save dialog: {}", e)),
  }
}
