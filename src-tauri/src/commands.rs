use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::{AppHandle, Manager, State};

use crate::compatibility::{self, Recommendation};
use crate::core::errors::FusionError;
use crate::core::ids::new_id;
use crate::core::paths;
use crate::core::state::{AppState, Application, Bottle, Runtime, Snapshot};
use crate::core::templates::{self, TEMPLATE_TYPES};
use crate::diagnostics::{self, FixIntent};
use crate::installer::{self, InstallerAnalysis};
use crate::manager::{dirs, FusionState, Jobs};
use crate::process::{ProcessManager, RunningInfo};
use crate::runtime::{self, catalog};
use crate::wine::engine::{RuntimeEngine, WineEngine};
use crate::wine::scanner::{self, DiscoveredExe};

fn now_ts() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_default()
}

fn wine_binary_for(app: &AppHandle, runtime_id: &str) -> Result<String, FusionError> {
    let st = app.state::<FusionState>();
    let rt = st
        .0
        .lock()
        .map_err(|_| FusionError::Unsupported)?
        .runtimes
        .iter()
        .find(|r| r.id == runtime_id)
        .cloned();

    if let Some(r) = rt {
        if let Some(bin) = runtime::engine_binary(Path::new(&r.path)) {
            return Ok(bin.to_string_lossy().into_owned());
        }
    }

    // Check custom path in settings
    if let Ok(state) = st.0.lock() {
        if let Some((_, custom_path)) = state.settings.iter().find(|(k, _)| k == "wine_binary_path") {
            if !custom_path.is_empty() && Path::new(custom_path).exists() {
                return Ok(custom_path.clone());
            }
        }
    }

    // Check user Library Whisky installation
    if let Ok(home) = std::env::var("HOME").map(PathBuf::from) {
        let whisky_bin = home.join("Library/Application Support/com.isaacmarovitz.Whisky/Libraries/Wine/bin/wine64");
        if whisky_bin.exists() {
            return Ok(whisky_bin.to_string_lossy().into_owned());
        }
        let fc_runtime_bin = home.join("Library/Application Support/FusionCross/runtimes/whisky-wine/bin/wine64");
        if fc_runtime_bin.exists() {
            return Ok(fc_runtime_bin.to_string_lossy().into_owned());
        }
    }

    // Standard macOS locations (Homebrew, CrossOver, Whisky)
    let candidates = [
        "/opt/homebrew/bin/wine64",
        "/opt/homebrew/bin/wine",
        "/usr/local/bin/wine64",
        "/usr/local/bin/wine",
        "/Applications/CrossOver.app/Contents/SharedSupport/CrossOver/bin/wine64",
        "/Applications/CrossOver.app/Contents/SharedSupport/CrossOver/bin/wine",
        "/Applications/Whisky.app/Contents/Resources/Wine/bin/wine64",
    ];

    for cand in candidates {
        if Path::new(cand).exists() {
            return Ok(cand.to_string());
        }
    }

    // Check PATH via which
    if let Ok(out) = std::process::Command::new("which").arg("wine64").output() {
        if out.status.success() {
            let p = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !p.is_empty() && Path::new(&p).exists() {
                return Ok(p);
            }
        }
    }
    if let Ok(out) = std::process::Command::new("which").arg("wine").output() {
        if out.status.success() {
            let p = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !p.is_empty() && Path::new(&p).exists() {
                return Ok(p);
            }
        }
    }

    Err(FusionError::RuntimeNotFound)
}

/* ---------- read commands ---------- */

#[tauri::command]
pub fn get_state(state: State<'_, FusionState>) -> Result<AppState, FusionError> {
    Ok(state
        .0
        .lock()
        .map_err(|_| FusionError::Unsupported)?
        .clone())
}

#[derive(Debug, Clone, Serialize)]
pub struct SystemInfo {
    pub app_version: &'static str,
    pub arch: &'static str,
    pub os: &'static str,
    pub engines: Vec<&'static str>,
}

#[tauri::command]
pub fn get_system_info() -> Result<SystemInfo, FusionError> {
    Ok(SystemInfo {
        app_version: env!("CARGO_PKG_VERSION"),
        arch: std::env::consts::ARCH,
        os: std::env::consts::OS,
        engines: vec!["Whisky-Wine (Apple GPTK)", "Wine Stable"],
    })
}

#[tauri::command]
pub fn probe_runtime(app: AppHandle, engine: String) -> Result<runtime::RuntimeStatus, FusionError> {
    let version = if let Ok(bin) = wine_binary_for(&app, &engine) {
        let out = std::process::Command::new(&bin).arg("--version").output();
        out.ok()
            .and_then(|o| crate::wine::engine::parse_wine_version(&String::from_utf8_lossy(&o.stdout)))
            .unwrap_or_else(|| "11.0".into())
    } else {
        let e = WineEngine::new(&engine);
        e.version().unwrap_or_else(|_| "not found".into())
    };
    Ok(runtime::RuntimeStatus {
        name: engine,
        version,
    })
}

#[tauri::command]
pub fn get_templates() -> Result<Vec<serde_json::Value>, FusionError> {
    Ok(TEMPLATE_TYPES
        .iter()
        .filter_map(|t| templates::bottle_template(t).ok())
        .map(|c| {
            serde_json::json!({
                "type": c.prefix_type,
                "label": c.label,
                "description": c.description,
                "windows_version": c.windows_version,
                "graphics": c.graphics,
                "dxvk_enabled": c.dxvk_enabled,
                "msync_enabled": c.msync_enabled,
                "performance_hud": c.performance_hud,
                "retina_mode": c.retina_mode,
                "dependencies": c.dependencies,
            })
        })
        .collect())
}

#[tauri::command]
pub fn get_runtimes(app: AppHandle) -> Result<Vec<serde_json::Value>, FusionError> {
    let st = app.state::<FusionState>();
    let state = st.0.lock().map_err(|_| FusionError::Unsupported)?;
    let whisky_installed = wine_binary_for(&app, "whisky-wine").is_ok();

    let mut list = Vec::new();
    list.push(serde_json::json!({
        "id": "whisky-wine",
        "name": "Whisky-Wine (Apple GPTK + DXVK + DXMT)",
        "category": "whisky",
        "version": "11.0",
        "downloaded": whisky_installed,
        "path": if whisky_installed { "Installed" } else { "" },
        "url": "https://github.com/frankea/Whisky/releases",
        "note": "Apple Game Porting Toolkit translation engine with DirectX 11/12 Metal support."
    }));

    for r in &state.runtimes {
        list.push(serde_json::json!({
            "id": r.id, "name": r.name, "category": r.category,
            "downloaded": r.downloaded, "version": r.version, "path": r.path
        }));
    }

    for c in catalog() {
        if !list.iter().any(|item| item["id"] == c.id) {
            let installed = state.runtimes.iter().any(|r| r.id == c.id);
            list.push(serde_json::json!({
                "id": c.id, "name": c.name, "category": c.category,
                "version": c.version, "downloaded": installed, "path": "",
                "url": c.url, "sha256": c.sha256, "note": c.note
            }));
        }
    }

    Ok(list)
}

/* ---------- bottles ---------- */

#[tauri::command]
pub fn create_bottle(
    app: AppHandle,
    name: String,
    template_type: String,
) -> Result<Bottle, FusionError> {
    let template = templates::bottle_template(&template_type)?;
    let id = new_id();
    let d = dirs(&app);
    let path = d.bottles.join(&id);
    std::fs::create_dir_all(&path).map_err(|_| FusionError::PermissionDenied)?;

    let bottle = Bottle {
        id: id.clone(),
        name,
        prefix_type: template.prefix_type.to_string(),
        runtime: "Wine Stable".to_string(),
        windows_version: template.windows_version.to_string(),
        graphics: template.graphics.to_string(),
        dxvk_enabled: template.dxvk_enabled,
        msync_enabled: template.msync_enabled,
        performance_hud: template.performance_hud,
        retina_mode: template.retina_mode,
        path: path.to_string_lossy().into_owned(),
        created_at: now_ts(),
        last_used_at: None,
        environment: template
            .environment
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect(),
        dll_overrides: template
            .dll_overrides
            .iter()
            .map(|s| s.to_string())
            .collect(),
        dependencies: template
            .dependencies
            .iter()
            .map(|s| s.to_string())
            .collect(),
    };

    {
        let st = app.state::<FusionState>();
        st.with_state(|s| {
            s.bottles.push(bottle.clone());
            Ok(())
        })?;
        st.save(&app)?;
    }

    // Initialize the prefix as a background job so the UI stays fast.
    let jobs = app.state::<Jobs>();
    let job = jobs.begin("Initializing bottle prefix".to_string());
    let job_id = job.clone();
    let handle = app.clone();
    let bottle_id_init = bottle.id.clone();
    std::thread::spawn(move || {
        let result = initialize_bottle_prefix(&handle, &bottle_id_init);
        let jobs = handle.state::<Jobs>();
        match result {
            Ok(msg) => jobs.finish(&job_id, msg),
            Err(e) => jobs.fail(&job_id, e.to_string()),
        }
    });

    Ok(bottle)
}

fn initialize_bottle_prefix(app: &AppHandle, bottle_id: &str) -> Result<String, FusionError> {
    let st = app.state::<FusionState>();
    let bottle = st
        .with_state(|s| Ok(s.bottles.iter().find(|b| b.id == bottle_id).cloned()))?
        .ok_or(FusionError::BottleNotFound)?;
    let binary = wine_binary_for(app, &bottle.runtime)?;
    let prefix = Path::new(&bottle.path);
    crate::wine::prefix::init_prefix(&binary, prefix)?;
    crate::wine::prefix::install_verbs(&binary, prefix, &bottle.dependencies)?;
    Ok("Prefix ready".to_string())
}

#[tauri::command]
pub fn repair_bottle(app: AppHandle, bottle_id: String) -> Result<String, FusionError> {
    initialize_bottle_prefix(&app, &bottle_id)
}

#[tauri::command]
pub fn delete_bottle(app: AppHandle, bottle_id: String) -> Result<(), FusionError> {
    let d = dirs(&app);
    let st = app.state::<FusionState>();
    let bottle = st.with_state(|s| {
        s.bottles
            .iter()
            .find(|b| b.id == bottle_id)
            .cloned()
            .ok_or(FusionError::BottleNotFound)
    })?;
    paths::safe_remove_all(&d.bottles, Path::new(&bottle.path))?;
    st.with_state(|s| {
        s.bottles.retain(|b| b.id != bottle_id);
        s.applications.retain(|a| a.bottle_id != bottle_id);
        s.snapshots.retain(|x| x.bottle_id != bottle_id);
        Ok(())
    })?;
    st.save(&app)?;
    Ok(())
}

#[tauri::command]
pub fn clone_bottle(
    app: AppHandle,
    bottle_id: String,
    new_name: String,
) -> Result<Bottle, FusionError> {
    let d = dirs(&app);
    let st = app.state::<FusionState>();
    let (source, apps_to_clone) = st.with_state(|s| {
        let b = s
            .bottles
            .iter()
            .find(|b| b.id == bottle_id)
            .cloned()
            .ok_or(FusionError::BottleNotFound)?;
        let apps = s
            .applications
            .iter()
            .filter(|a| a.bottle_id == bottle_id)
            .cloned()
            .collect::<Vec<_>>();
        Ok((b, apps))
    })?;
    let id = new_id();
    let new_path = d.bottles.join(&id);
    paths::safe_copy_all(&d.bottles, Path::new(&source.path), &new_path)?;

    let clone = Bottle {
        id: id.clone(),
        name: new_name,
        path: new_path.to_string_lossy().into_owned(),
        ..source.clone()
    };
    st.with_state(|s| {
        s.bottles.push(clone.clone());
        let source_prefix = &source.path;
        let new_prefix_str = new_path.to_string_lossy();
        for app_rec in apps_to_clone {
            let rel_exe = app_rec
                .executable_path
                .strip_prefix(source_prefix)
                .unwrap_or(&app_rec.executable_path);
            let updated_exe = format!("{new_prefix_str}{rel_exe}");
            s.applications.push(Application {
                id: new_id(),
                bottle_id: id.clone(),
                executable_path: updated_exe,
                launch_count: 0,
                play_time_mins: 0,
                last_played: None,
                ..app_rec
            });
        }
        Ok(())
    })?;
    st.save(&app)?;
    Ok(clone)
}

#[tauri::command]
pub fn open_bottle_c_drive(app: AppHandle, bottle_id: String) -> Result<(), FusionError> {
    let st = app.state::<FusionState>();
    let bottle = st.with_state(|s| {
        s.bottles
            .iter()
            .find(|b| b.id == bottle_id)
            .cloned()
            .ok_or(FusionError::BottleNotFound)
    })?;
    let drive_c = Path::new(&bottle.path).join("drive_c");
    std::fs::create_dir_all(&drive_c).map_err(|_| FusionError::PermissionDenied)?;
    std::process::Command::new("open")
        .arg(&drive_c)
        .spawn()
        .map_err(|_| FusionError::LaunchFailed)?;
    Ok(())
}

#[tauri::command]
pub fn reveal_in_finder(path: String) -> Result<(), FusionError> {
    let p = Path::new(&path);
    if p.exists() {
        std::process::Command::new("open")
            .arg("-R")
            .arg(&path)
            .spawn()
            .map_err(|_| FusionError::LaunchFailed)?;
        Ok(())
    } else {
        Err(FusionError::InvalidExecutable)
    }
}

#[tauri::command]
pub fn run_command_in_bottle(
    app: AppHandle,
    bottle_id: String,
    command: String,
    args: Vec<String>,
) -> Result<(), FusionError> {
    let st = app.state::<FusionState>();
    let bottle = st.with_state(|s| {
        s.bottles
            .iter()
            .find(|b| b.id == bottle_id)
            .cloned()
            .ok_or(FusionError::BottleNotFound)
    })?;
    let binary = wine_binary_for(&app, &bottle.runtime)?;
    let prefix = Path::new(&bottle.path);
    if !crate::wine::prefix::prefix_prepared(prefix) {
        crate::wine::prefix::init_prefix(&binary, prefix)?;
    }

    let mut cmd = std::process::Command::new(&binary);
    cmd.env("WINEPREFIX", prefix);
    if bottle.msync_enabled {
        cmd.env("WINEMSYNC", "1");
        cmd.env("WINE_MSYNC", "1");
    }
    if !bottle.dll_overrides.is_empty() {
        cmd.env("WINEDLLOVERRIDES", bottle.dll_overrides.join(";"));
    }
    cmd.arg(&command);
    for arg in args {
        cmd.arg(arg);
    }
    cmd.spawn().map_err(|_| FusionError::LaunchFailed)?;
    Ok(())
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn update_bottle(
    app: AppHandle,
    bottle_id: String,
    windows_version: Option<String>,
    graphics: Option<String>,
    dxvk_enabled: Option<bool>,
    msync_enabled: Option<bool>,
    performance_hud: Option<bool>,
    retina_mode: Option<bool>,
    environment: Option<Vec<(String, String)>>,
    dll_overrides: Option<Vec<String>>,
) -> Result<(), FusionError> {
    let st = app.state::<FusionState>();
    st.with_state(|s| {
        let b = s
            .bottles
            .iter_mut()
            .find(|b| b.id == bottle_id)
            .ok_or(FusionError::BottleNotFound)?;
        if let Some(v) = windows_version {
            b.windows_version = v;
        }
        if let Some(g) = graphics {
            b.graphics = g;
        }
        if let Some(d) = dxvk_enabled {
            b.dxvk_enabled = d;
        }
        if let Some(m) = msync_enabled {
            b.msync_enabled = m;
        }
        if let Some(p) = performance_hud {
            b.performance_hud = p;
        }
        if let Some(r) = retina_mode {
            b.retina_mode = r;
        }
        if let Some(e) = environment {
            b.environment = e;
        }
        if let Some(o) = dll_overrides {
            b.dll_overrides = o;
        }
        Ok(())
    })?;
    st.save(&app)
}

#[tauri::command]
pub fn kill_bottle_processes(app: AppHandle, bottle_id: String) -> Result<(), FusionError> {
    let st = app.state::<FusionState>();
    let (bottle, app_ids) = st.with_state(|s| {
        let b = s
            .bottles
            .iter()
            .find(|b| b.id == bottle_id)
            .cloned()
            .ok_or(FusionError::BottleNotFound)?;
        let running_ids: Vec<String> = s
            .applications
            .iter()
            .filter(|a| a.bottle_id == bottle_id)
            .map(|a| a.id.clone())
            .collect();
        Ok((b, running_ids))
    })?;

    let pm = app.state::<ProcessManager>();
    for aid in app_ids {
        if pm.is_running(&aid) {
            pm.stop(&aid).ok();
        }
    }

    let binary = wine_binary_for(&app, &bottle.runtime)?;
    crate::wine::prefix::kill_wineserver(&binary, Path::new(&bottle.path))?;
    Ok(())
}

#[tauri::command]
pub fn launch_wine_tool(
    app: AppHandle,
    bottle_id: String,
    tool: String,
) -> Result<u32, FusionError> {
    let st = app.state::<FusionState>();
    let bottle = st.with_state(|s| {
        s.bottles
            .iter()
            .find(|b| b.id == bottle_id)
            .cloned()
            .ok_or(FusionError::BottleNotFound)
    })?;
    let binary = wine_binary_for(&app, &bottle.runtime)?;
    let prefix = Path::new(&bottle.path);
    if !crate::wine::prefix::prefix_prepared(prefix) {
        crate::wine::prefix::init_prefix(&binary, prefix)?;
    }
    crate::wine::prefix::launch_wine_tool(&binary, prefix, &tool)
}

#[tauri::command]
pub fn install_bottle_verb(
    app: AppHandle,
    bottle_id: String,
    verb: String,
) -> Result<String, FusionError> {
    let st = app.state::<FusionState>();
    let bottle = st.with_state(|s| {
        s.bottles
            .iter()
            .find(|b| b.id == bottle_id)
            .cloned()
            .ok_or(FusionError::BottleNotFound)
    })?;
    let binary = wine_binary_for(&app, &bottle.runtime)?;
    let prefix = PathBuf::from(&bottle.path);

    let jobs = app.state::<Jobs>();
    let job = jobs.begin(format!("Installing {verb} into {}", bottle.name));
    let job_id = job.clone();
    let handle = app.clone();
    let verb_clone = verb.clone();
    let bottle_id_clone = bottle_id.clone();

    std::thread::spawn(move || {
        let jobs = handle.state::<Jobs>();
        match crate::wine::prefix::install_verbs(
            &binary,
            &prefix,
            std::slice::from_ref(&verb_clone),
        ) {
            Ok(()) => {
                let st = handle.state::<FusionState>();
                let _ = st.with_state(|s| {
                    if let Some(b) = s.bottles.iter_mut().find(|b| b.id == bottle_id_clone) {
                        if !b.dependencies.contains(&verb_clone) {
                            b.dependencies.push(verb_clone.clone());
                        }
                    }
                    Ok(())
                });
                let _ = st.save(&handle);
                jobs.finish(&job_id, format!("Installed {verb_clone} successfully."));
            }
            Err(e) => jobs.fail(&job_id, format!("Failed installing {verb_clone}: {e}")),
        }
    });

    Ok(job)
}

/* ---------- installer + discovery ---------- */

#[tauri::command]
pub fn analyze_installer(path: String) -> Result<InstallerAnalysis, FusionError> {
    installer::analyze_installer(Path::new(&path))
}

#[tauri::command]
pub fn scan_bottle(app: AppHandle, bottle_id: String) -> Result<Vec<DiscoveredExe>, FusionError> {
    let st = app.state::<FusionState>();
    let bottle = st.with_state(|s| {
        s.bottles
            .iter()
            .find(|b| b.id == bottle_id)
            .cloned()
            .ok_or(FusionError::BottleNotFound)
    })?;
    let found = scanner::scan_prefix(Path::new(&bottle.path));
    st.with_state(|s| {
        for exe in &found {
            let full_path = Path::new(&bottle.path).join(&exe.rel_path).to_string_lossy().into_owned();
            if !s.applications.iter().any(|a| a.bottle_id == bottle_id && a.executable_path == full_path) {
                let rec = compatibility::recommend(&exe.name);
                s.applications.push(Application {
                    id: new_id(),
                    bottle_id: bottle_id.clone(),
                    name: exe.name.clone(),
                    executable_path: full_path,
                    category: exe.category.clone(),
                    favorite: false,
                    launch_count: 0,
                    play_time_mins: 0,
                    last_played: None,
                    compatibility: Some(rec.compatibility),
                    profile: Some(rec.profile.to_string()),
                });
            }
        }
        Ok(())
    })?;
    st.save(&app)?;
    Ok(found)
}

#[tauri::command]
pub fn scan_all_bottles(app: AppHandle) -> Result<usize, FusionError> {
    let st = app.state::<FusionState>();
    let bottles = st.with_state(|s| Ok(s.bottles.clone()))?;
    let mut total_added = 0;

    for bottle in &bottles {
        let found = scanner::scan_prefix(Path::new(&bottle.path));
        st.with_state(|s| {
            for exe in &found {
                let full_path = Path::new(&bottle.path).join(&exe.rel_path).to_string_lossy().into_owned();
                if !s.applications.iter().any(|a| a.bottle_id == bottle.id && (a.executable_path == full_path || a.name == exe.name)) {
                    let rec = compatibility::recommend(&exe.name);
                    s.applications.push(Application {
                        id: new_id(),
                        bottle_id: bottle.id.clone(),
                        name: exe.name.clone(),
                        executable_path: full_path,
                        category: exe.category.clone(),
                        favorite: false,
                        launch_count: 0,
                        play_time_mins: 0,
                        last_played: None,
                        compatibility: Some(rec.compatibility),
                        profile: Some(rec.profile.to_string()),
                    });
                    total_added += 1;
                }
            }
            Ok(())
        })?;
    }

    if total_added > 0 {
        st.save(&app)?;
    }
    Ok(total_added)
}

#[tauri::command]
pub fn register_application(
    app: AppHandle,
    bottle_id: String,
    name: String,
    executable_path: String,
    category: String,
) -> Result<Application, FusionError> {
    let st = app.state::<FusionState>();
    let rec = compatibility::recommend(&name);
    let application = st.with_state(|s| {
        if let Some(existing) = s
            .applications
            .iter_mut()
            .find(|a| a.bottle_id == bottle_id && (a.executable_path == executable_path || a.name == name))
        {
            existing.executable_path = executable_path;
            existing.name = name;
            return Ok(existing.clone());
        }
        let app = Application {
            id: new_id(),
            bottle_id,
            name,
            executable_path,
            category,
            favorite: false,
            launch_count: 0,
            play_time_mins: 0,
            last_played: None,
            compatibility: Some(rec.compatibility),
            profile: Some(rec.profile.to_string()),
        };
        s.applications.push(app.clone());
        Ok(app)
    })?;
    st.save(&app)?;
    Ok(application)
}

#[tauri::command]
pub fn run_installer(
    app: AppHandle,
    installer_path: String,
    bottle_id: String,
) -> Result<String, FusionError> {
    // Stage the installer into the prefix's installers folder.
    let analysis = installer::analyze_installer(Path::new(&installer_path))?;
    let jobs = app.state::<Jobs>();
    let job = jobs.begin(format!("Installing {}", analysis.file_name));
    let job_id = job.clone();
    let handle = app.clone();

    std::thread::spawn(move || {
        let jobs = handle.state::<Jobs>();
        let outcome = install_job(&handle, &bottle_id, &installer_path, &analysis.file_name);
        match outcome {
            Ok(msg) => jobs.finish(&job_id, msg),
            Err(e) => jobs.fail(&job_id, format!("{} — {e}", analysis.file_name)),
        }
    });
    Ok(job)
}

fn install_job(
    app: &AppHandle,
    bottle_id: &str,
    installer_path: &str,
    file_name: &str,
) -> Result<String, FusionError> {
    let st = app.state::<FusionState>();
    let bottle = st.with_state(|s| {
        s.bottles
            .iter()
            .find(|b| b.id == bottle_id)
            .cloned()
            .ok_or(FusionError::BottleNotFound)
    })?;
    let binary = wine_binary_for(app, &bottle.runtime)?;
    let prefix = Path::new(&bottle.path);

    initialize_bottle_prefix(app, bottle_id)?;

    // Copy the installer into the prefix so Wine can reach it.
    let target_dir = prefix.join("drive_c").join("installers");
    std::fs::create_dir_all(&target_dir).map_err(|_| FusionError::PermissionDenied)?;
    let target = target_dir.join(file_name);
    std::fs::copy(installer_path, &target).map_err(|_| FusionError::InvalidExecutable)?;

    let mut cmd = std::process::Command::new(&binary);
    cmd.env("WINEPREFIX", prefix);
    if !bottle.dll_overrides.is_empty() {
        cmd.env("WINEDLLOVERRIDES", bottle.dll_overrides.join(";"));
    }
    let status = cmd
        .arg(&target)
        .status()
        .map_err(|_| FusionError::LaunchFailed)?;
    if !status.success() {
        return Err(FusionError::InstallationFailed);
    }

    // Discover whatever the installer laid down.
    let found = scanner::scan_prefix(prefix);
    let mut registered = 0;
    st.with_state(|s| {
        for exe in &found {
            // dupe by executable path inside this bottle
            if s.applications
                .iter()
                .any(|a| a.bottle_id == bottle_id && a.executable_path == exe.rel_path)
            {
                continue;
            }
            s.applications.push(Application {
                id: new_id(),
                bottle_id: bottle_id.to_string(),
                name: exe.name.clone(),
                executable_path: prefix.join(&exe.rel_path).to_string_lossy().into_owned(),
                category: exe.category.clone(),
                favorite: false,
                launch_count: 0,
                play_time_mins: 0,
                last_played: None,
                compatibility: None,
                profile: None,
            });
            registered += 1;
        }
        Ok(())
    })?;
    st.save(app)?;
    Ok(format!(
        "Installed. Discovered {registered} application(s)."
    ))
}

#[tauri::command]
pub fn list_jobs(app: AppHandle) -> Result<Vec<crate::manager::Job>, FusionError> {
    Ok(app.state::<Jobs>().list())
}

/* ---------- launch / stop ---------- */

#[tauri::command]
pub fn launch_application(app: AppHandle, app_id: String) -> Result<RunningInfo, FusionError> {
    let st = app.state::<FusionState>();
    let (application, bottle) = st.with_state(|s| {
        let a = s
            .applications
            .iter()
            .find(|a| a.id == app_id)
            .cloned()
            .ok_or(FusionError::ApplicationNotFound)?;
        let b = s
            .bottles
            .iter()
            .find(|b| b.id == a.bottle_id)
            .cloned()
            .ok_or(FusionError::BottleNotFound)?;
        Ok((a, b))
    })?;

    let pm = app.state::<ProcessManager>();
    if pm.is_running(&app_id) {
        return Err(FusionError::LaunchFailed);
    }
    let binary = wine_binary_for(&app, &bottle.runtime)?;
    let prefix = Path::new(&bottle.path);
    if !crate::wine::prefix::prefix_prepared(prefix) {
        crate::wine::prefix::init_prefix(&binary, prefix)?;
    }

    let safe = settings_bool(&app, "safe_mode");
    let mut override_env = if safe {
        vec![]
    } else {
        bottle.environment.clone()
    };

    if !safe {
        // MSync: Mach semaphore fast synchronization on macOS (PRD / CrossOver parity)
        if bottle.msync_enabled {
            override_env.push(("WINEMSYNC".into(), "1".into()));
            override_env.push(("WINE_MSYNC".into(), "1".into()));
            override_env.push(("WINEESYNC".into(), "0".into()));
            override_env.push(("WINEFSYNC".into(), "0".into()));
        } else {
            override_env.push(("WINEMSYNC".into(), "0".into()));
            override_env.push(("WINEESYNC".into(), "0".into()));
        }

        // Performance HUD: Apple Metal HUD + DXVK HUD
        if bottle.performance_hud {
            override_env.push(("MTL_HUD_ENABLED".into(), "1".into()));
            override_env.push((
                "DXVK_HUD".into(),
                "fps,frametimes,gputemp,memory,version".into(),
            ));
        }

        // Retina mode: High-DPI display scaling
        if bottle.retina_mode {
            override_env.push(("WINE_DPI".into(), "192".into()));
            override_env.push(("ENABLE_RETINA".into(), "1".into()));
        }
    }

    let dll_overrides = if safe {
        String::new()
    } else {
        let mut overrides = bottle.dll_overrides.clone();
        match bottle.graphics.as_str() {
            "d3dmetal" => {
                overrides.push("d3d11,d3d12,dxgi=n,b".into());
            }
            "dxvk" => {
                overrides.push("d3d9,d3d10core,d3d11,dxgi=n,b".into());
            }
            "dxmt" => {
                overrides.push("d3d11=n,b".into());
            }
            "wined3d" => {
                overrides.push("d3d9,d3d10core,d3d11,d3d12,dxgi=b".into());
            }
            _ => {}
        }
        overrides.push("mscoree,mshtml=".into());
        overrides.join(";")
    };

    let info = pm.spawn(
        &app_id,
        &bottle.id,
        &application.name,
        &binary,
        &bottle.path,
        &application.executable_path,
        &[],
        &override_env,
        &dll_overrides,
    )?;

    // Record the launch.
    st.with_state(|s| {
        if let Some(a) = s.applications.iter_mut().find(|a| a.id == app_id) {
            a.launch_count += 1;
            a.last_played = Some(now_ts());
        }
        if let Some(b) = s.bottles.iter_mut().find(|b| b.id == bottle.id) {
            b.last_used_at = Some(now_ts());
        }
        Ok(())
    })?;
    st.save(&app)?;
    Ok(info)
}

#[tauri::command]
pub fn stop_application(app: AppHandle, app_id: String) -> Result<(), FusionError> {
    app.state::<ProcessManager>().stop(&app_id)
}

#[tauri::command]
pub fn list_running(app: AppHandle) -> Result<Vec<RunningInfo>, FusionError> {
    Ok(app.state::<ProcessManager>().running())
}

#[tauri::command]
pub fn toggle_favorite(app: AppHandle, app_id: String) -> Result<(), FusionError> {
    let st = app.state::<FusionState>();
    st.with_state(|s| {
        let a = s
            .applications
            .iter_mut()
            .find(|a| a.id == app_id)
            .ok_or(FusionError::ApplicationNotFound)?;
        a.favorite = !a.favorite;
        Ok(())
    })?;
    st.save(&app)
}

fn settings_bool(app: &AppHandle, key: &str) -> bool {
    app.state::<FusionState>()
        .0
        .lock()
        .ok()
        .and_then(|g| {
            g.settings
                .iter()
                .find(|(k, _)| k == key)
                .map(|(_, v)| v == "on")
        })
        .unwrap_or(false)
}

/* ---------- compatibility / diagnostics / fixes ---------- */

#[tauri::command]
pub fn get_recommendation(name: String) -> Result<Recommendation, FusionError> {
    Ok(compatibility::recommend(&name))
}

#[tauri::command]
pub fn run_diagnostics(
    app: AppHandle,
    app_id: String,
) -> Result<Vec<diagnostics::DiagnosticCheck>, FusionError> {
    let state = app
        .state::<FusionState>()
        .0
        .lock()
        .map_err(|_| FusionError::Unsupported)?
        .clone();
    Ok(diagnostics::run_app_diagnostics(&state, &app_id))
}

#[tauri::command]
pub fn apply_fix(app: AppHandle, fix_id: String, app_id: String) -> Result<String, FusionError> {
    let intent = FixIntent::from_id(&fix_id).ok_or(FusionError::Unsupported)?;
    match intent {
        FixIntent::InstallRuntime => {
            Ok("Install Wine:\n\n  brew install --cask --no-quarantine wine-stable\n\nThen try launching again.".into())
        }
        FixIntent::InitPrefix => {
            let st = app.state::<FusionState>();
            let bottle = st.with_state(|s| s.applications.iter().find(|a| a.id == app_id).and_then(|a| s.bottles.iter().find(|b| b.id == a.bottle_id)).cloned().ok_or(FusionError::BottleNotFound))?;
                    let binary = wine_binary_for(&app, &bottle.runtime)?;
            crate::wine::prefix::init_prefix(&binary, Path::new(&bottle.path))?;
            Ok("Prefix initialized.".into())
        }
        FixIntent::InstallDependency(verb) => {
            let st = app.state::<FusionState>();
            let bottle = st.with_state(|s| s.applications.iter().find(|a| a.id == app_id).and_then(|a| s.bottles.iter().find(|b| b.id == a.bottle_id)).cloned().ok_or(FusionError::BottleNotFound))?;
                    let binary = wine_binary_for(&app, &bottle.runtime)?;
            crate::wine::prefix::install_verbs(&binary, Path::new(&bottle.path), &[verb.to_string()])?;
            Ok(format!("Installed {verb}."))
        }
        FixIntent::SwitchGraphics => {
            let st = app.state::<FusionState>();
            st.with_state(|s| {
                let app2 = s.applications.iter().find(|a| a.id == app_id).cloned().ok_or(FusionError::ApplicationNotFound)?;
                let b = s.bottles.iter_mut().find(|b| b.id == app2.bottle_id).ok_or(FusionError::BottleNotFound)?;
                b.dxvk_enabled = false;
                b.graphics = "wined3d".to_string();
                Ok(())
            })?;
            st.save(&app)?;
            Ok("Switched graphics to WineD3D.".into())
        }
        FixIntent::EnableMsync => {
            let st = app.state::<FusionState>();
            st.with_state(|s| {
                let app2 = s.applications.iter().find(|a| a.id == app_id).cloned().ok_or(FusionError::ApplicationNotFound)?;
                let b = s.bottles.iter_mut().find(|b| b.id == app2.bottle_id).ok_or(FusionError::BottleNotFound)?;
                b.msync_enabled = true;
                Ok(())
            })?;
            st.save(&app)?;
            Ok("Enabled MSync fast synchronization for this bottle.".into())
        }
        FixIntent::InstallRosetta => {
            Ok("Run this command in Terminal to install Apple Rosetta 2:\n\n  /usr/sbin/softwareupdate --install-rosetta --agree-to-license\n\nThen restart FusionCross.".into())
        }
    }
}

/* ---------- snapshots ---------- */

#[tauri::command]
pub fn create_snapshot(
    app: AppHandle,
    bottle_id: String,
    name: String,
) -> Result<Snapshot, FusionError> {
    let d = dirs(&app);
    let st = app.state::<FusionState>();
    let bottle = st.with_state(|s| {
        s.bottles
            .iter()
            .find(|b| b.id == bottle_id)
            .cloned()
            .ok_or(FusionError::BottleNotFound)
    })?;
    let (archive_path, size) =
        crate::snapshots::create_snapshot(&d.bottles, &d.snapshots, &bottle)?;
    let snapshot = Snapshot {
        id: new_id(),
        bottle_id,
        name,
        path: archive_path,
        size_bytes: size,
        created_at: now_ts(),
    };
    st.with_state(|s| {
        s.snapshots.push(snapshot.clone());
        Ok(())
    })?;
    st.save(&app)?;
    Ok(snapshot)
}

#[tauri::command]
pub fn restore_snapshot(app: AppHandle, snapshot_id: String) -> Result<(), FusionError> {
    let d = dirs(&app);
    let st = app.state::<FusionState>();
    let (bottle, snap) = st.with_state(|s| {
        let snap = s
            .snapshots
            .iter()
            .find(|x| x.id == snapshot_id)
            .cloned()
            .ok_or(FusionError::Unsupported)?;
        let b = s
            .bottles
            .iter()
            .find(|b| b.id == snap.bottle_id)
            .cloned()
            .ok_or(FusionError::BottleNotFound)?;
        Ok((b, snap))
    })?;
    crate::snapshots::restore_snapshot(&d.snapshots, Path::new(&snap.path), &bottle)?;
    Ok(())
}

#[tauri::command]
pub fn delete_snapshot(app: AppHandle, snapshot_id: String) -> Result<(), FusionError> {
    let d = dirs(&app);
    let st = app.state::<FusionState>();
    let snap = st.with_state(|s| {
        s.snapshots
            .iter()
            .find(|x| x.id == snapshot_id)
            .cloned()
            .ok_or(FusionError::Unsupported)
    })?;
    crate::snapshots::delete_snapshot(&d.snapshots, Path::new(&snap.path))?;
    st.with_state(|s| {
        s.snapshots.retain(|x| x.id != snapshot_id);
        Ok(())
    })?;
    st.save(&app)?;
    Ok(())
}

/* ---------- runtimes ---------- */

/// Download + verify + install a catalog runtime as a background job.
#[tauri::command]
pub fn download_runtime(app: AppHandle, runtime_id: String) -> Result<String, FusionError> {
    let entry = catalog()
        .into_iter()
        .find(|c| c.id == runtime_id)
        .ok_or(FusionError::RuntimeNotFound)?;
    if entry.sha256.is_empty() {
        return Err(FusionError::RuntimeVerificationFailed);
    }

    let jobs = app.state::<Jobs>();
    let job = jobs.begin(format!("Downloading {}", entry.name));
    let job_id = job.clone();
    let handle = app.clone();
    std::thread::spawn(move || {
        let d = dirs(&handle);
        let id = entry.id.clone();
        let name = entry.name.clone();
        let category = entry.category.to_string();
        let url = entry.url.to_string();
        let sha = entry.sha256.to_string();
        let dest_pkg = d.downloads.join(format!("{id}.tar.xz"));
        let dest_dir = d.runtimes.join(&id);
        let jobs = handle.state::<Jobs>();
        let result = runtime::download_runtime(&url, &sha, &dest_pkg, &dest_dir);
        match result {
            Ok(()) => {
                let version = runtime::probe_runtime_version(&dest_dir).unwrap_or_default();
                let rt = handle.state::<FusionState>();
                let _ = rt.with_state(|s| {
                    s.runtimes.push(Runtime {
                        id: id.clone(),
                        name: name.clone(),
                        category: category.clone(),
                        downloaded: true,
                        version: version.clone(),
                        path: dest_dir.to_string_lossy().into_owned(),
                        url: url.clone(),
                        sha256: sha.clone(),
                        size_bytes: 0,
                    });
                    Ok(())
                });
                let _ = rt.save(&handle);
                jobs.finish(&job_id, format!("{name} installed (v{version})."));
            }
            Err(e) => jobs.fail(&job_id, format!("{name} — {e}")),
        }
    });
    Ok(job)
}

#[tauri::command]
pub fn import_runtime(
    app: AppHandle,
    name: String,
    archive_path: String,
) -> Result<Runtime, FusionError> {
    let d = dirs(&app);
    let source = Path::new(&archive_path);
    if !source.is_file() {
        return Err(FusionError::InvalidExecutable);
    }
    // Stage into our own downloads dir before touching anything.
    let staged = d.downloads.join(format!("{}.pkg", new_id()));
    let mut ext = source
        .extension()
        .map(|e| e.to_string_lossy().into_owned())
        .unwrap_or_default();
    if ext.is_empty() {
        ext = "tar.xz".into();
    }
    let staged = staged.with_extension(ext);
    std::fs::copy(source, &staged).map_err(|_| FusionError::InvalidExecutable)?;

    let id = new_id();
    let dest = d.runtimes.join(&id);
    let version = crate::runtime::install_from_archive(&staged, &dest)?;
    std::fs::remove_file(&staged).ok();

    let runtime = Runtime {
        id: id.clone(),
        name,
        category: "custom".into(),
        downloaded: true,
        version,
        path: dest.to_string_lossy().into_owned(),
        url: String::new(),
        sha256: String::new(),
        size_bytes: 0,
    };
    let st = app.state::<FusionState>();
    st.with_state(|s| {
        s.runtimes.push(runtime.clone());
        Ok(())
    })?;
    st.save(&app)?;
    Ok(runtime)
}

#[tauri::command]
pub fn remove_runtime(app: AppHandle, runtime_id: String) -> Result<(), FusionError> {
    let d = dirs(&app);
    let st = app.state::<FusionState>();
    let rt = st.with_state(|s| {
        s.runtimes
            .iter()
            .find(|r| r.id == runtime_id)
            .cloned()
            .ok_or(FusionError::RuntimeNotFound)
    })?;
    if rt.downloaded && !rt.path.is_empty() {
        paths::safe_remove_all(&d.runtimes, Path::new(&rt.path))?;
    }
    st.with_state(|s| {
        s.runtimes.retain(|r| r.id != runtime_id);
        Ok(())
    })?;
    st.save(&app)?;
    Ok(())
}

/* ---------- settings ---------- */

#[tauri::command]
pub fn set_safe_mode(app: AppHandle, enabled: bool) -> Result<(), FusionError> {
    let st = app.state::<FusionState>();
    st.with_state(|s| {
        if let Some(slot) = s.settings.iter_mut().find(|(k, _)| k == "safe_mode") {
            slot.1 = if enabled { "on" } else { "off" }.into();
        } else {
            s.settings.push((
                "safe_mode".into(),
                if enabled { "on" } else { "off" }.into(),
            ));
        }
        Ok(())
    })?;
    st.save(&app)
}

#[tauri::command]
pub fn export_app_bundle(app: AppHandle, app_id: String) -> Result<String, FusionError> {
    let st = app.state::<FusionState>();
    let application = st.with_state(|s| {
        s.applications
            .iter()
            .find(|a| a.id == app_id)
            .cloned()
            .ok_or(FusionError::ApplicationNotFound)
    })?;

    let home = std::env::var("HOME").map_err(|_| FusionError::Unsupported)?;
    let target_dir = PathBuf::from(home).join("Applications").join("FusionCross");
    let bundle_path =
        crate::exporter::create_mac_app_bundle(&application.name, &application.id, &target_dir)?;
    Ok(bundle_path.to_string_lossy().into_owned())
}
