#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};

// ========================================================
// DATA STRUCTURES
// ========================================================

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
}

// ========================================================
// SANDBOX RESULT STRUCTURES
// ========================================================

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

// ========================================================
// GLOBAL MUTABLE STATE
// ========================================================

pub struct AppState {
  pub bottles: Mutex<Vec<Bottle>>,
  pub apps: Mutex<Vec<AppConfig>>,
  pub runtimes: Mutex<Vec<Runtime>>,
  pub active_process_id: Mutex<Option<String>>,
  pub active_child_pid: Mutex<Option<u32>>,
}

// ========================================================
// PATH SECURITY & SANITIZATION
// ========================================================

/// Base directory where all FusionWine sandboxes are stored.
/// All path validations ensure we never escape this directory.
fn get_fusionwine_base_dir() -> PathBuf {
  let home = std::env::var("HOME").unwrap_or_else(|_| "/Users/omkar".to_string());
  PathBuf::from(home)
    .join("Library")
    .join("Application Support")
    .join("FusionWine")
}

/// Validates that a given path resolves within the allowed FusionWine base directory.
/// Prevents path traversal attacks (e.g., ../../etc/passwd).
fn validate_sandbox_path(target: &Path) -> Result<PathBuf, String> {
  let base = get_fusionwine_base_dir();
  let canonical_base = fs::canonicalize(&base).unwrap_or_else(|_| base.clone());

  // Resolve the target path relative to base
  let resolved = if target.is_absolute() {
    target.to_path_buf()
  } else {
    base.join(target)
  };

  // If the target doesn't exist yet, verify its parent chain
  let check_path = if resolved.exists() {
    fs::canonicalize(&resolved).map_err(|e| format!("Path resolution failed: {}", e))?
  } else {
    // Walk up to find the closest existing ancestor
    let mut ancestor = resolved.clone();
    while !ancestor.exists() {
      ancestor = ancestor.parent()
        .ok_or_else(|| "Invalid path: no existing ancestor".to_string())?
        .to_path_buf();
    }
    let canonical_ancestor = fs::canonicalize(&ancestor)
      .map_err(|e| format!("Ancestor path resolution failed: {}", e))?;
    // Re-append the remaining suffix
    let suffix = resolved.strip_prefix(&ancestor).unwrap_or(Path::new(""));
    canonical_ancestor.join(suffix)
  };

  if check_path.starts_with(&canonical_base) || check_path.starts_with(&base) {
    Ok(resolved)
  } else {
    Err(format!(
      "Security: path '{}' escapes the FusionWine sandbox directory '{}'",
      resolved.display(),
      base.display()
    ))
  }
}

// ========================================================
// COMMAND IMPLEMENTATIONS
// ========================================================

#[tauri::command]
fn list_bottles(state: State<'_, AppState>) -> Result<Vec<Bottle>, String> {
  let bottles = state.bottles.lock().map_err(|e| e.to_string())?;
  Ok(bottles.clone())
}

#[tauri::command]
fn create_bottle(
  name: String,
  prefix_type: String,
  wine_version: String,
  state: State<'_, AppState>,
) -> Result<Bottle, String> {
  let mut bottles = state.bottles.lock().map_err(|e| e.to_string())?;
  
  let new_id = format!("bottle-{}", rand::random::<u16>());
  let base = get_fusionwine_base_dir();
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

  // Actually create the sandbox directories on disk
  let _ = initialize_prefix_sandbox_impl(&path, &prefix_type);

  // Calculate real size on disk
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
    created_at: "2026-05-22".to_string(),
  };

  bottles.push(new_bottle.clone());
  Ok(new_bottle)
}

#[tauri::command]
fn delete_bottle(id: String, state: State<'_, AppState>) -> Result<String, String> {
  let mut bottles = state.bottles.lock().map_err(|e| e.to_string())?;
  let index = bottles.iter().position(|b| b.id == id)
    .ok_or_else(|| "Bottle not found".to_string())?;
  
  // Clean up the real filesystem sandbox if it exists
  let bottle_path = bottles[index].path.clone();
  let path = Path::new(&bottle_path);
  if path.exists() {
    // Validate we're only deleting inside FusionWine directories
    if let Ok(_) = validate_sandbox_path(path) {
      let _ = fs::remove_dir_all(path);
    }
  }

  bottles.remove(index);
  
  // Clean up any apps assigned to this bottle
  let mut apps = state.apps.lock().map_err(|e| e.to_string())?;
  apps.retain(|a| a.bottle_id != id);

  Ok(id)
}

#[tauri::command]
fn clone_bottle(id: String, target_name: String, state: State<'_, AppState>) -> Result<Bottle, String> {
  let mut bottles = state.bottles.lock().map_err(|e| e.to_string())?;
  let index = bottles.iter().position(|b| b.id == id)
    .ok_or_else(|| "Bottle not found".to_string())?;
  
  let source = &bottles[index];
  let clone_id = format!("bottle-{}", rand::random::<u16>());
  
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
    size_bytes: source.size_bytes,
    path: format!("/Users/omkar/.gemini/antigravity/scratch/fusionwine/bottles/{}", clone_id),
    created_at: "2026-05-22".to_string(),
  };

  bottles.push(cloned.clone());
  Ok(cloned)
}

#[tauri::command]
fn update_bottle_settings(
  id: String,
  win_version: String,
  dxvk_enabled: bool,
  moltenvk_enabled: bool,
  dll_overrides: Vec<DllOverride>,
  env_vars: HashMap<String, String>,
  registry_keys: Vec<RegistryKey>,
  state: State<'_, AppState>,
) -> Result<Bottle, String> {
  let mut bottles = state.bottles.lock().map_err(|e| e.to_string())?;
  let index = bottles.iter().position(|b| b.id == id)
    .ok_or_else(|| "Bottle not found".to_string())?;
  
  let bottle = &mut bottles[index];
  bottle.win_version = win_version;
  bottle.dxvk_enabled = dxvk_enabled;
  bottle.moltenvk_enabled = moltenvk_enabled;
  bottle.dll_overrides = dll_overrides;
  bottle.env_vars = env_vars;
  bottle.registry_keys = registry_keys;

  Ok(bottle.clone())
}

#[tauri::command]
fn list_apps(state: State<'_, AppState>) -> Result<Vec<AppConfig>, String> {
  let apps = state.apps.lock().map_err(|e| e.to_string())?;
  Ok(apps.clone())
}

#[tauri::command]
fn register_app(
  name: String,
  exe_path: String,
  arguments: String,
  bottle_id: String,
  category: String,
  tags: Vec<String>,
  state: State<'_, AppState>,
) -> Result<AppConfig, String> {
  let mut apps = state.apps.lock().map_err(|e| e.to_string())?;
  
  let app_id = format!("app-{}", rand::random::<u16>());
  
  // Pick matching icon based on app name or default
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
    bottle_id,
    last_played: None,
    play_time_mins: 0,
    favorite: false,
  };

  apps.push(new_app.clone());
  Ok(new_app)
}

#[tauri::command]
fn toggle_favorite(id: String, state: State<'_, AppState>) -> Result<AppConfig, String> {
  let mut apps = state.apps.lock().map_err(|e| e.to_string())?;
  let index = apps.iter().position(|a| a.id == id)
    .ok_or_else(|| "App not found".to_string())?;
  
  apps[index].favorite = !apps[index].favorite;
  Ok(apps[index].clone())
}

#[tauri::command]
fn run_app(id: String, state: State<'_, AppState>, app_handle: AppHandle) -> Result<String, String> {
  let mut apps = state.apps.lock().map_err(|e| e.to_string())?;
  let index = apps.iter().position(|a| a.id == id)
    .ok_or_else(|| "App not found".to_string())?;
  
  let app = &mut apps[index];
  
  // Update last played meta
  let date_str = "2026-05-22T18:14:00Z".to_string();
  app.last_played = Some(date_str);
  app.play_time_mins += rand::random::<u8>() as u32 % 15 + 1; // simulated play addition
  
  let app_name = app.name.clone();
  
  // Register active process ID
  let mut active = state.active_process_id.lock().map_err(|e| e.to_string())?;
  *active = Some(id.clone());

  // Spawn an async thread to simulate runtime log telemetry streaming to the frontend
  let app_name_clone = app_name.clone();
  std::thread::spawn(move || {
    let logs = vec![
      format!("esync: up and running."),
      format!("wine: WGL-MoltenVK graphics backend preloaded."),
      format!("dxvk: DXVK 2.3 loader initialized."),
      format!("dxvk: MoltenVK dynamic loading: vkGetInstanceProcAddr found"),
      format!("win: Direct3D9Device adapter config successful."),
      format!("render: Shader compiler cached 240 Vulkan state pipelines."),
      format!("game: Steam overlay API hooked."),
      format!("audio: OpenAL device successfully configured on CoreAudio (macOS output)."),
      format!("sys: Process spawned with CPU affinity mask: 0xFF."),
      format!("game: Launching primary executable: {}...", app_name_clone),
    ];

    for log in logs {
      std::thread::sleep(Duration::from_millis(600));
      let payload = format!("[Wine:Logs] [{}] {}", app_name_clone, log);
      let _ = app_handle.emit("wine-log-stream", payload);
    }
  });

  Ok(app_name)
}

#[tauri::command]
fn stop_active_app(state: State<'_, AppState>) -> Result<bool, String> {
  let mut active = state.active_process_id.lock().map_err(|e| e.to_string())?;
  if active.is_some() {
    *active = None;
    Ok(true)
  } else {
    Ok(false)
  }
}

#[tauri::command]
fn list_runtimes(state: State<'_, AppState>) -> Result<Vec<Runtime>, String> {
  let runtimes = state.runtimes.lock().map_err(|e| e.to_string())?;
  Ok(runtimes.clone())
}

#[tauri::command]
fn trigger_runtime_download(id: String, state: State<'_, AppState>, app_handle: AppHandle) -> Result<String, String> {
  let mut runtimes = state.runtimes.lock().map_err(|e| e.to_string())?;
  let index = runtimes.iter().position(|r| r.id == id)
    .ok_or_else(|| "Runtime not found".to_string())?;
  
  if runtimes[index].downloaded {
    return Ok(id);
  }

  let r_name = runtimes[index].name.clone();
  let r_id = id.clone();
  
  // Simulated progressive downloader running in background
  std::thread::spawn(move || {
    let mut progress = 0;
    while progress < 100 {
      std::thread::sleep(Duration::from_millis(150));
      progress += rand::random::<u8>() as u32 % 10 + 5;
      if progress > 100 { progress = 100; }
      
      #[derive(Serialize, Clone)]
      struct DownProgress {
        id: String,
        progress: u32,
      }
      let _ = app_handle.emit("download-progress", DownProgress { id: r_id.clone(), progress });
    }
  });

  runtimes[index].downloaded = true;
  Ok(r_name)
}

#[tauri::command]
fn get_system_metrics(state: State<'_, AppState>) -> Result<SysMetrics, String> {
  let active = state.active_process_id.lock().map_err(|e| e.to_string())?;
  
  let fps = if active.is_some() {
    // Simulate game running
    rand::random::<u32>() % 25 + 75 // 75 - 100 FPS
  } else {
    0
  };

  let shader = if active.is_some() {
    rand::random::<u32>() % 5 + 95 // 95 - 100 % compiled
  } else {
    0
  };

  let (cpu, gpu) = if active.is_some() {
    (
      rand::random::<f32>() * 15.0 + 35.0, // 35 - 50% CPU
      rand::random::<f32>() * 20.0 + 60.0  // 60 - 80% GPU
    )
  } else {
    (
      rand::random::<f32>() * 3.0 + 1.2,   // 1 - 4% CPU idling
      rand::random::<f32>() * 2.0 + 0.5    // 0 - 2% GPU idling
    )
  };

  Ok(SysMetrics {
    cpu_usage: cpu,
    ram_usage_percent: 64.2,
    ram_used_gb: 10.27,
    ram_total_gb: 16.0,
    disk_free_gb: 184.2,
    gpu_usage: gpu,
    fps,
    shader_compilation_percent: shader,
  })
}

// ========================================================
// REAL SANDBOXING COMMANDS
// ========================================================

/// Internal implementation for creating the WinePrefix directory structure.
/// Called both from `create_bottle` and `initialize_prefix_sandbox` commands.
fn initialize_prefix_sandbox_impl(prefix_path: &str, prefix_type: &str) -> Result<SandboxInfo, String> {
  let base_path = Path::new(prefix_path);

  // Validate path stays within FusionWine sandbox
  validate_sandbox_path(base_path)?;

  // Core directory structure mimicking a real WinePrefix
  let directories = vec![
    base_path.join("drive_c"),
    base_path.join("drive_c").join("windows"),
    base_path.join("drive_c").join("windows").join("system32"),
    base_path.join("drive_c").join("windows").join("syswow64"),
    base_path.join("drive_c").join("windows").join("Fonts"),
    base_path.join("drive_c").join("windows").join("Installer"),
    base_path.join("drive_c").join("windows").join("temp"),
    base_path.join("drive_c").join("Program Files"),
    base_path.join("drive_c").join("Program Files (x86)"),
    base_path.join("drive_c").join("ProgramData"),
    base_path.join("drive_c").join("users"),
    base_path.join("drive_c").join("users").join("steamuser"),
    base_path.join("drive_c").join("users").join("steamuser").join("Desktop"),
    base_path.join("drive_c").join("users").join("steamuser").join("Documents"),
    base_path.join("drive_c").join("users").join("steamuser").join("Downloads"),
    base_path.join("drive_c").join("users").join("steamuser").join("AppData"),
    base_path.join("drive_c").join("users").join("steamuser").join("AppData").join("Local"),
    base_path.join("drive_c").join("users").join("steamuser").join("AppData").join("Roaming"),
    base_path.join("dosdevices"),
  ];

  let mut total_files: u32 = 0;

  for dir in &directories {
    fs::create_dir_all(dir).map_err(|e| format!("Failed to create directory {}: {}", dir.display(), e))?;
    total_files += 1;
  }

  // Create DOS device symlinks (c: -> drive_c)
  let dos_c = base_path.join("dosdevices").join("c:");
  if !dos_c.exists() {
    #[cfg(unix)]
    {
      let _ = std::os::unix::fs::symlink(base_path.join("drive_c"), &dos_c);
      total_files += 1;
    }
  }

  // Create Wine-compatible registry files with valid default values
  let system_reg_content = format!(
    r#"WINE REGISTRY Version 2
;; FusionWine Auto-Generated System Registry
;; Prefix Type: {prefix_type}
;; Generated: 2026-05-22

[System\\CurrentControlSet\\Control\\Windows]
"CSDVersion"=dword:00000200

[Software\\Microsoft\\Windows\\CurrentVersion]
"ProgramFilesDir"="C:\\Program Files"
"CommonFilesDir"="C:\\Program Files\\Common Files"

[Software\\Microsoft\\Windows NT\\CurrentVersion]
"CurrentBuild"="19045"
"CurrentBuildNumber"="19045"
"CurrentVersion"="6.3"
"ProductName"="Windows 10 Pro"

[Software\\Wine\\DllOverrides]
"d3d11"="native,builtin"
"d3d9"="native,builtin"
"dxgi"="native,builtin"
"d3d10core"="native,builtin"

[Software\\Wine\\Direct3D]
"MaxShaderModelVS"=dword:00000005
"MaxShaderModelPS"=dword:00000005
"MaxShaderModelGS"=dword:00000005
"csmt"=dword:00000003
"#
  );

  let user_reg_content = format!(
    r#"WINE REGISTRY Version 2
;; FusionWine Auto-Generated User Registry
;; Generated: 2026-05-22

[Software\\Wine\\Mac Driver]
"RetinaMode"="Y"

[Software\\Wine\\DllOverrides]
"winemenubuilder.exe"=""

[Control Panel\\Desktop]
"FontSmoothing"="2"
"FontSmoothingType"=dword:00000002
"FontSmoothingGamma"=dword:00000578
"#
  );

  let system_reg_path = base_path.join("system.reg");
  let user_reg_path = base_path.join("user.reg");
  let userdef_reg_path = base_path.join("userdef.reg");

  let mut f = fs::File::create(&system_reg_path)
    .map_err(|e| format!("Failed to create system.reg: {}", e))?;
  f.write_all(system_reg_content.as_bytes())
    .map_err(|e| format!("Failed to write system.reg: {}", e))?;
  total_files += 1;

  let mut f = fs::File::create(&user_reg_path)
    .map_err(|e| format!("Failed to create user.reg: {}", e))?;
  f.write_all(user_reg_content.as_bytes())
    .map_err(|e| format!("Failed to write user.reg: {}", e))?;
  total_files += 1;

  let mut f = fs::File::create(&userdef_reg_path)
    .map_err(|e| format!("Failed to create userdef.reg: {}", e))?;
  f.write_all(b"WINE REGISTRY Version 2\n;; Default user registry\n")
    .map_err(|e| format!("Failed to write userdef.reg: {}", e))?;
  total_files += 1;

  // Inject placeholder DLL override stubs into system32
  let mut dll_stubs: Vec<String> = Vec::new();
  let dlls_to_inject = ["d3d11.dll", "d3d9.dll", "dxgi.dll", "d3d10core.dll"];
  for dll_name in &dlls_to_inject {
    let dll_path = base_path.join("drive_c").join("windows").join("system32").join(dll_name);
    let stub_content = format!(
      "FusionWine DLL Override Stub\nLibrary: {}\nType: native,builtin\nNote: Replace this stub with real DXVK library for graphics translation.\n",
      dll_name
    );
    let mut f = fs::File::create(&dll_path)
      .map_err(|e| format!("Failed to create stub {}: {}", dll_name, e))?;
    f.write_all(stub_content.as_bytes())
      .map_err(|e| format!("Failed to write stub {}: {}", dll_name, e))?;
    dll_stubs.push(dll_name.to_string());
    total_files += 1;
  }

  // Create a .update-timestamp marker (Wine compatibility)
  let timestamp_path = base_path.join(".update-timestamp");
  fs::write(&timestamp_path, "1716393600").map_err(|e| format!("Failed to write timestamp: {}", e))?;
  total_files += 1;

  let info = SandboxInfo {
    bottle_id: String::new(), // filled by caller
    prefix_path: prefix_path.to_string(),
    drive_c_path: base_path.join("drive_c").to_string_lossy().to_string(),
    system32_path: base_path.join("drive_c").join("windows").join("system32").to_string_lossy().to_string(),
    program_files_path: base_path.join("drive_c").join("Program Files").to_string_lossy().to_string(),
    registry_files: vec![
      system_reg_path.to_string_lossy().to_string(),
      user_reg_path.to_string_lossy().to_string(),
      userdef_reg_path.to_string_lossy().to_string(),
    ],
    dll_overrides_injected: dll_stubs,
    total_files_created: total_files,
  };

  Ok(info)
}

/// Calculate the total size of a directory recursively.
fn calculate_dir_size(path: &Path) -> u64 {
  if !path.exists() {
    return 0;
  }
  let mut total: u64 = 0;
  if let Ok(entries) = fs::read_dir(path) {
    for entry in entries.flatten() {
      let meta = entry.metadata();
      if let Ok(m) = meta {
        if m.is_dir() {
          total += calculate_dir_size(&entry.path());
        } else {
          total += m.len();
        }
      }
    }
  }
  total
}

#[tauri::command]
fn initialize_prefix_sandbox(bottle_id: String, prefix_path: String, prefix_type: String) -> Result<SandboxInfo, String> {
  let mut info = initialize_prefix_sandbox_impl(&prefix_path, &prefix_type)?;
  info.bottle_id = bottle_id;
  Ok(info)
}

#[tauri::command]
fn reset_sandbox(bottle_id: String, prefix_path: String) -> Result<String, String> {
  let path = Path::new(&prefix_path);
  
  // Security: validate path is within FusionWine sandbox
  validate_sandbox_path(path)?;

  if path.exists() {
    fs::remove_dir_all(path).map_err(|e| format!("Failed to remove sandbox: {}", e))?;
  }

  // Recreate a fresh sandbox
  let _ = initialize_prefix_sandbox_impl(&prefix_path, "gaming")?;

  Ok(format!("Sandbox '{}' has been reset successfully", bottle_id))
}

#[tauri::command]
fn open_prefix_in_finder(prefix_path: String) -> Result<bool, String> {
  let path = Path::new(&prefix_path);
  
  if !path.exists() {
    return Err(format!("Path does not exist: {}", prefix_path));
  }

  Command::new("open")
    .arg(&prefix_path)
    .spawn()
    .map_err(|e| format!("Failed to open Finder: {}", e))?;

  Ok(true)
}

#[tauri::command]
fn download_wine_engine(
  engine_url: String,
  target_id: String,
  app_handle: AppHandle,
) -> Result<String, String> {
  let base = get_fusionwine_base_dir();
  let runtimes_dir = base.join("runtimes");
  let target_dir = runtimes_dir.join(&target_id);
  
  fs::create_dir_all(&target_dir)
    .map_err(|e| format!("Failed to create runtime directory: {}", e))?;

  let target_id_clone = target_id.clone();
  let target_dir_clone = target_dir.clone();

  // Spawn async download thread with progress emission
  std::thread::spawn(move || {
    // Emit starting progress
    let _ = app_handle.emit("download-progress", DownloadProgress {
      id: target_id_clone.clone(),
      progress: 0,
      status: "downloading".to_string(),
      message: format!("Starting download from {}...", engine_url),
    });

    // Use native curl to download (zero external Rust dependencies)
    let archive_path = target_dir_clone.join("engine.tar.gz");
    let curl_result = Command::new("curl")
      .args(["-L", "-o"])
      .arg(archive_path.to_string_lossy().as_ref())
      .arg(&engine_url)
      .arg("--progress-bar")
      .stdout(Stdio::piped())
      .stderr(Stdio::piped())
      .output();

    match curl_result {
      Ok(output) => {
        if !output.status.success() {
          let err = String::from_utf8_lossy(&output.stderr);
          let _ = app_handle.emit("download-progress", DownloadProgress {
            id: target_id_clone.clone(),
            progress: 0,
            status: "error".to_string(),
            message: format!("Download failed: {}", err),
          });
          return;
        }

        let _ = app_handle.emit("download-progress", DownloadProgress {
          id: target_id_clone.clone(),
          progress: 60,
          status: "extracting".to_string(),
          message: "Download complete. Extracting archive...".to_string(),
        });

        // Extract with tar
        let tar_result = Command::new("tar")
          .args(["-xzf"])
          .arg(archive_path.to_string_lossy().as_ref())
          .arg("-C")
          .arg(target_dir_clone.to_string_lossy().as_ref())
          .output();

        match tar_result {
          Ok(tar_out) => {
            if tar_out.status.success() {
              // Clean up the archive file
              let _ = fs::remove_file(&archive_path);

              let _ = app_handle.emit("download-progress", DownloadProgress {
                id: target_id_clone.clone(),
                progress: 100,
                status: "complete".to_string(),
                message: "Engine installed successfully!".to_string(),
              });
            } else {
              let err = String::from_utf8_lossy(&tar_out.stderr);
              let _ = app_handle.emit("download-progress", DownloadProgress {
                id: target_id_clone.clone(),
                progress: 60,
                status: "error".to_string(),
                message: format!("Extraction failed: {}", err),
              });
            }
          }
          Err(e) => {
            let _ = app_handle.emit("download-progress", DownloadProgress {
              id: target_id_clone.clone(),
              progress: 60,
              status: "error".to_string(),
              message: format!("Failed to run tar: {}", e),
            });
          }
        }
      }
      Err(e) => {
        let _ = app_handle.emit("download-progress", DownloadProgress {
          id: target_id_clone.clone(),
          progress: 0,
          status: "error".to_string(),
          message: format!("Failed to start curl: {}", e),
        });
      }
    }
  });

  Ok(format!("Download started for engine '{}'", target_id))
}

#[tauri::command]
fn execute_windows_binary(
  prefix_path: String,
  exe_path: String,
  arguments: String,
  app_handle: AppHandle,
  _state: State<'_, AppState>,
) -> Result<String, String> {
  // Try to find a Wine binary on the system
  let wine_candidates = [
    // Homebrew Wine
    "/usr/local/bin/wine64",
    "/opt/homebrew/bin/wine64",
    // CrossOver Wine
    "/Applications/CrossOver.app/Contents/SharedSupport/CrossOver/bin/wine64",
    // Game Porting Toolkit
    "/usr/local/Cellar/game-porting-toolkit/1.1/bin/wine64",
    // Whisky bundled Wine
    "/Applications/Whisky.app/Contents/Resources/Wine/bin/wine64",
  ];

  let wine_path = wine_candidates.iter()
    .find(|p| Path::new(p).exists())
    .map(|p| p.to_string());

  let prefix_clone = prefix_path.clone();
  let exe_clone = exe_path.clone();

  match wine_path {
    Some(wine_bin) => {
      // Real Wine execution path
      let wine_bin_clone = wine_bin.clone();
      
      std::thread::spawn(move || {
        let _ = app_handle.emit("wine-log-stream", format!(
          "[FusionWine] Detected Wine binary at: {}", wine_bin_clone
        ));
        let _ = app_handle.emit("wine-log-stream", format!(
          "[FusionWine] WINEPREFIX={}", prefix_clone
        ));
        let _ = app_handle.emit("wine-log-stream", format!(
          "[FusionWine] Launching: {} {}", exe_clone, arguments
        ));

        let child = Command::new(&wine_bin_clone)
          .env("WINEPREFIX", &prefix_clone)
          .env("WINEDLLOVERRIDES", "d3d11,dxgi=n,b")
          .env("DXVK_HUD", "fps")
          .env("WINEESYNC", "1")
          .env("WINEFSYNC", "1")
          .arg(&exe_clone)
          .args(arguments.split_whitespace())
          .stdout(Stdio::piped())
          .stderr(Stdio::piped())
          .spawn();

        match child {
          Ok(mut process) => {
            let _ = app_handle.emit("wine-log-stream", format!(
              "[FusionWine] Process spawned with PID: {}", process.id()
            ));

            // Stream stderr (Wine outputs its logs to stderr)
            if let Some(stderr) = process.stderr.take() {
              let reader = BufReader::new(stderr);
              for line in reader.lines() {
                if let Ok(log_line) = line {
                  let _ = app_handle.emit("wine-log-stream", format!("[Wine] {}", log_line));
                }
              }
            }

            let _ = process.wait();
            let _ = app_handle.emit("wine-log-stream", "[FusionWine] Process exited.".to_string());
          }
          Err(e) => {
            let _ = app_handle.emit("wine-log-stream", format!(
              "[FusionWine:Error] Failed to spawn Wine process: {}", e
            ));
          }
        }
      });

      Ok(format!("Launching via Wine: {}", exe_path))
    }
    None => {
      // No Wine found — run simulated logs for demonstration
      let exe_name = exe_path.clone();

      std::thread::spawn(move || {
        let logs = vec![
          "[FusionWine] No Wine binary found on system. Running in simulation mode.".to_string(),
          format!("[FusionWine] WINEPREFIX={}", prefix_clone),
          format!("[FusionWine] Target executable: {}", exe_name),
          "[sim] esync: up and running.".to_string(),
          "[sim] wine: WGL-MoltenVK graphics backend preloaded.".to_string(),
          "[sim] dxvk: DXVK 2.3 loader initialized.".to_string(),
          "[sim] dxvk: MoltenVK dynamic loading: vkGetInstanceProcAddr found.".to_string(),
          "[sim] win: Direct3D11Device adapter config successful.".to_string(),
          "[sim] render: Shader compiler cached 240 Vulkan state pipelines.".to_string(),
          "[sim] audio: OpenAL device configured on CoreAudio.".to_string(),
          format!("[sim] game: Launching primary executable: {}...", exe_name),
          "[FusionWine] Install Wine via Homebrew to enable real execution:".to_string(),
          "[FusionWine]   brew install --cask --no-quarantine wine-stable".to_string(),
        ];

        for log in logs {
          std::thread::sleep(Duration::from_millis(500));
          let _ = app_handle.emit("wine-log-stream", log);
        }
      });

      Ok(format!("Simulated launch (no Wine binary found): {}", exe_path))
    }
  }
}

// ========================================================
// APPLICATION BOOTSTRAP
// ========================================================

fn main() {
  // Pre-seed some default runtime and bottle entries so the app has high-quality interactive initial content
  let default_bottles = vec![
    Bottle {
      id: "bottle-gaming".to_string(),
      name: "Steam Gaming Bottle".to_string(),
      prefix_type: "gaming".to_string(),
      wine_version: "Proton GE 9.0".to_string(),
      dxvk_enabled: true,
      moltenvk_enabled: true,
      win_version: "win10".to_string(),
      env_vars: HashMap::from([
        ("DXVK_HUD".to_string(), "fps".to_string()),
        ("WINEESYNC".to_string(), "1".to_string()),
      ]),
      dll_overrides: vec![
        DllOverride { library: "d3d11".to_string(), override_type: "native,builtin".to_string() }
      ],
      registry_keys: vec![],
      size_bytes: 3_240_000_000,
      path: "/Users/omkar/.gemini/antigravity/scratch/fusionwine/bottles/bottle-gaming".to_string(),
      created_at: "2026-05-10".to_string(),
    },
    Bottle {
      id: "bottle-office".to_string(),
      name: "MS Office Suite".to_string(),
      prefix_type: "productivity".to_string(),
      wine_version: "Wine Stable 9.0".to_string(),
      dxvk_enabled: false,
      moltenvk_enabled: false,
      win_version: "win10".to_string(),
      env_vars: HashMap::new(),
      dll_overrides: vec![],
      registry_keys: vec![],
      size_bytes: 1_120_000_000,
      path: "/Users/omkar/.gemini/antigravity/scratch/fusionwine/bottles/bottle-office".to_string(),
      created_at: "2026-05-18".to_string(),
    }
  ];

  let default_apps = vec![
    AppConfig {
      id: "app-steam".to_string(),
      name: "Steam Launcher".to_string(),
      exe_path: "C:\\Program Files (x86)\\Steam\\Steam.exe".to_string(),
      arguments: "-nofriendsui".to_string(),
      icon: "steam".to_string(),
      category: "Games".to_string(),
      tags: vec!["Store".to_string(), "Online".to_string()],
      bottle_id: "bottle-gaming".to_string(),
      last_played: Some("2026-05-20T21:40:00Z".to_string()),
      play_time_mins: 840,
      favorite: true,
    },
    AppConfig {
      id: "app-cyberpunk".to_string(),
      name: "Cyberpunk 2077".to_string(),
      exe_path: "C:\\GOG Games\\Cyberpunk 2077\\bin\\x64\\Cyberpunk2077.exe".to_string(),
      arguments: "-skipStartScreen".to_string(),
      icon: "cyberpunk".to_string(),
      category: "Games".to_string(),
      tags: vec!["RPG".to_string(), "Vulkan".to_string(), "Action".to_string()],
      bottle_id: "bottle-gaming".to_string(),
      last_played: Some("2026-05-22T02:15:00Z".to_string()),
      play_time_mins: 3420,
      favorite: true,
    },
    AppConfig {
      id: "app-word".to_string(),
      name: "Microsoft Word".to_string(),
      exe_path: "C:\\Program Files\\Microsoft Office\\root\\Office16\\WINWORD.EXE".to_string(),
      arguments: "".to_string(),
      icon: "office".to_string(),
      category: "Productivity".to_string(),
      tags: vec!["Office".to_string(), "Docs".to_string()],
      bottle_id: "bottle-office".to_string(),
      last_played: Some("2026-05-22T14:30:00Z".to_string()),
      play_time_mins: 120,
      favorite: false,
    }
  ];

  let default_runtimes = vec![
    Runtime {
      id: "wine-stable".to_string(),
      name: "Wine Stable 9.0".to_string(),
      category: "wine".to_string(),
      version: "9.0.0".to_string(),
      size_bytes: 840_000_000,
      downloaded: true,
      path: "/Users/omkar/.gemini/antigravity/scratch/fusionwine/runtimes/wine-stable".to_string(),
    },
    Runtime {
      id: "proton-ge".to_string(),
      name: "Proton GE 9.0 (Custom Gaming)".to_string(),
      category: "proton".to_string(),
      version: "GE-9.0-1".to_string(),
      size_bytes: 1_280_000_000,
      downloaded: true,
      path: "/Users/omkar/.gemini/antigravity/scratch/fusionwine/runtimes/proton-ge".to_string(),
    },
    Runtime {
      id: "proton-exp".to_string(),
      name: "Proton Experimental".to_string(),
      category: "proton".to_string(),
      version: "Experimental".to_string(),
      size_bytes: 1_420_000_000,
      downloaded: false,
      path: "/Users/omkar/.gemini/antigravity/scratch/fusionwine/runtimes/proton-exp".to_string(),
    },
    Runtime {
      id: "dxvk-23".to_string(),
      name: "DXVK Translation Layer v2.3".to_string(),
      category: "dxvk".to_string(),
      version: "2.3.0".to_string(),
      size_bytes: 28_000_000,
      downloaded: true,
      path: "/Users/omkar/.gemini/antigravity/scratch/fusionwine/runtimes/dxvk-23".to_string(),
    },
    Runtime {
      id: "dxvk-latest".to_string(),
      name: "DXVK Master (Nightly Build)".to_string(),
      category: "dxvk".to_string(),
      version: "Git-Nightly".to_string(),
      size_bytes: 31_000_000,
      downloaded: false,
      path: "/Users/omkar/.gemini/antigravity/scratch/fusionwine/runtimes/dxvk-latest".to_string(),
    }
  ];

  // Ensure the FusionWine base directories exist on first launch
  let base = get_fusionwine_base_dir();
  let _ = fs::create_dir_all(base.join("bottles"));
  let _ = fs::create_dir_all(base.join("runtimes"));

  let state = AppState {
    bottles: Mutex::new(default_bottles),
    apps: Mutex::new(default_apps),
    runtimes: Mutex::new(default_runtimes),
    active_process_id: Mutex::new(None),
    active_child_pid: Mutex::new(None),
  };

  tauri::Builder::default()
    .manage(state)
    .invoke_handler(tauri::generate_handler![
      list_bottles,
      create_bottle,
      delete_bottle,
      clone_bottle,
      update_bottle_settings,
      list_apps,
      register_app,
      toggle_favorite,
      run_app,
      stop_active_app,
      list_runtimes,
      trigger_runtime_download,
      get_system_metrics,
      // Real sandboxing commands
      initialize_prefix_sandbox,
      reset_sandbox,
      open_prefix_in_finder,
      download_wine_engine,
      execute_windows_binary
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
