#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};

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
// GLOBAL MUTABLE STATE
// ========================================================

pub struct AppState {
  pub bottles: Mutex<Vec<Bottle>>,
  pub apps: Mutex<Vec<AppConfig>>,
  pub runtimes: Mutex<Vec<Runtime>>,
  pub active_process_id: Mutex<Option<String>>,
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
  let path = format!("/Users/omkar/.gemini/antigravity/scratch/fusionwine/bottles/{}", new_id);

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
    size_bytes: 420_000_000, // mock initial bottle size (420MB)
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

  let state = AppState {
    bottles: Mutex::new(default_bottles),
    apps: Mutex::new(default_apps),
    runtimes: Mutex::new(default_runtimes),
    active_process_id: Mutex::new(None),
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
      get_system_metrics
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
