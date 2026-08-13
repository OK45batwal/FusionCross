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
use crate::runtime::{self, catalog, CatalogEntry};
use crate::wine::engine::{RuntimeEngine, WineEngine};
use crate::wine::scanner::{self, DiscoveredExe};

fn now_ts() -> String {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs().to_string()).unwrap_or_default()
}

fn wine_binary_for(app: &AppHandle, runtime_id: &str) -> String {
    let st = app.state::<FusionState>();
    let path = st
        .0
        .lock()
        .ok()
        .and_then(|g| g.runtimes.iter().find(|r| r.id == runtime_id).cloned())
        .and_then(|r| runtime::engine_binary(Path::new(&r.path)))
        .unwrap_or_else(|| PathBuf::from("wine"));
    path.to_string_lossy().into_owned()
}

/* ---------- read commands ---------- */

#[tauri::command]
pub fn get_state(state: State<'_, FusionState>) -> Result<AppState, FusionError> {
    Ok(state.0.lock().map_err(|_| FusionError::Unsupported)?.clone())
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
        engines: vec!["Wine Stable"],
    })
}

#[tauri::command]
pub fn probe_runtime(engine: &str) -> Result<runtime::RuntimeStatus, FusionError> {
    let e = WineEngine::new(engine);
    let version = e.version().unwrap_or_else(|_| "not found".into());
    Ok(runtime::RuntimeStatus { name: e.name().to_string(), version })
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
                "dependencies": c.dependencies,
            })
        })
        .collect())
}

#[tauri::command]
pub fn get_runtimes(app: AppHandle) -> Result<Vec<serde_json::Value>, FusionError> {
    let st = app.state::<FusionState>();
    let state = st.0.lock().map_err(|_| FusionError::Unsupported)?;
    Ok(state
        .runtimes
        .iter()
        .map(|r| {
            serde_json::json!({
                "id": r.id, "name": r.name, "category": r.category,
                "downloaded": r.downloaded, "version": r.version, "path": r.path
            })
        })
        .chain(catalog().into_iter().map(|c: CatalogEntry| {
            let installed = state.runtimes.iter().any(|r| r.id == c.id);
            serde_json::json!({
                "id": c.id, "name": c.name, "category": c.category,
                "version": c.version, "downloaded": installed, "path": "", "note": c.note
            })
        }))
        .collect())
}

/* ---------- bottles ---------- */

#[tauri::command]
pub fn create_bottle(app: AppHandle, name: String, template_type: String) -> Result<Bottle, FusionError> {
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
        path: path.to_string_lossy().into_owned(),
        created_at: now_ts(),
        last_used_at: None,
        environment: template.environment.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect(),
        dll_overrides: template.dll_overrides.iter().map(|s| s.to_string()).collect(),
        dependencies: template.dependencies.iter().map(|s| s.to_string()).collect(),
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
    let bottle = st.with_state(|s| Ok(s.bottles.iter().find(|b| b.id == bottle_id).cloned()))?.ok_or(FusionError::BottleNotFound)?;
    let binary = wine_binary_for(app, &bottle.runtime);
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
    let bottle = st.with_state(|s| s.bottles.iter().find(|b| b.id == bottle_id).cloned().ok_or(FusionError::BottleNotFound))?;
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
pub fn clone_bottle(app: AppHandle, bottle_id: String, new_name: String) -> Result<Bottle, FusionError> {
    let d = dirs(&app);
    let st = app.state::<FusionState>();
    let source = st.with_state(|s| s.bottles.iter().find(|b| b.id == bottle_id).cloned().ok_or(FusionError::BottleNotFound))?;
    let id = new_id();
    let new_path = d.bottles.join(&id);
    paths::safe_copy_all(&d.bottles, Path::new(&source.path), &new_path)?;

    let clone = Bottle {
        id: id.clone(),
        name: new_name,
        ..source.clone()
    };
    let clone = Bottle { path: new_path.to_string_lossy().into_owned(), ..clone };
    st.with_state(|s| {
        s.bottles.push(clone.clone());
        Ok(())
    })?;
    st.save(&app)?;
    Ok(clone)
}

#[tauri::command]
pub fn update_bottle(
    app: AppHandle,
    bottle_id: String,
    windows_version: Option<String>,
    graphics: Option<String>,
    dxvk_enabled: Option<bool>,
    environment: Option<Vec<(String, String)>>,
    dll_overrides: Option<Vec<String>>,
) -> Result<(), FusionError> {
    let st = app.state::<FusionState>();
    st.with_state(|s| {
        let b = s.bottles.iter_mut().find(|b| b.id == bottle_id).ok_or(FusionError::BottleNotFound)?;
        if let Some(v) = windows_version { b.windows_version = v; }
        if let Some(g) = graphics { b.graphics = g; }
        if let Some(d) = dxvk_enabled { b.dxvk_enabled = d; }
        if let Some(e) = environment { b.environment = e; }
        if let Some(o) = dll_overrides { b.dll_overrides = o; }
        Ok(())
    })?;
    st.save(&app)
}

/* ---------- installer + discovery ---------- */

#[tauri::command]
pub fn analyze_installer(path: String) -> Result<InstallerAnalysis, FusionError> {
    installer::analyze_installer(Path::new(&path))
}

#[tauri::command]
pub fn scan_bottle(app: AppHandle, bottle_id: String) -> Result<Vec<DiscoveredExe>, FusionError> {
    let st = app.state::<FusionState>();
    let bottle = st.with_state(|s| s.bottles.iter().find(|b| b.id == bottle_id).cloned().ok_or(FusionError::BottleNotFound))?;
    Ok(scanner::scan_prefix(Path::new(&bottle.path)))
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
        if s.applications.iter().any(|a| a.bottle_id == bottle_id && a.executable_path == executable_path) {
            return Err(FusionError::InvalidExecutable); // duplicate
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
            compatibility: Some(rec.compatibility.clone()),
            profile: Some(rec.profile.to_string()),
        };
        s.applications.push(app.clone());
        Ok(app)
    })?;
    st.save(&app)?;
    Ok(application)
}

#[tauri::command]
pub fn run_installer(app: AppHandle, installer_path: String, bottle_id: String) -> Result<String, FusionError> {
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

fn install_job(app: &AppHandle, bottle_id: &str, installer_path: &str, file_name: &str) -> Result<String, FusionError> {
    let st = app.state::<FusionState>();
    let bottle = st.with_state(|s| s.bottles.iter().find(|b| b.id == bottle_id).cloned().ok_or(FusionError::BottleNotFound))?;
    let binary = wine_binary_for(app, &bottle.runtime);
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
    // sleeper in case the installer exits before scanning
    let _ = () ;

    // Discover whatever the installer laid down.
    let found = scanner::scan_prefix(prefix);
    let mut registered = 0;
    st.with_state(|s| {
        for exe in &found {
            // dupe by executable path inside this bottle
            if s.applications.iter().any(|a| a.bottle_id == bottle_id && a.executable_path == exe.rel_path) {
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
    Ok(format!("Installed. Discovered {registered} application(s)."))
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
    let binary = wine_binary_for(&app, &bottle.runtime);
    let prefix = Path::new(&bottle.path);
    if !crate::wine::prefix::prefix_prepared(prefix) {
        crate::wine::prefix::init_prefix(&binary, prefix)?;
    }

    let safe = settings_bool(&app, "safe_mode");
    let override_env = if safe { vec![] } else { bottle.environment.clone() };
    let dll_overrides = if safe { String::new() } else { bottle.dll_overrides.join(";") };

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
        let a = s.applications.iter_mut().find(|a| a.id == app_id).ok_or(FusionError::ApplicationNotFound)?;
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
        .and_then(|g| g.settings.iter().find(|(k, _)| k == key).map(|(_, v)| v == "on"))
        .unwrap_or(false)
}

/* ---------- compatibility / diagnostics / fixes ---------- */

#[tauri::command]
pub fn get_recommendation(name: String) -> Result<Recommendation, FusionError> {
    Ok(compatibility::recommend(&name))
}

#[tauri::command]
pub fn run_diagnostics(app: AppHandle, app_id: String) -> Result<Vec<diagnostics::DiagnosticCheck>, FusionError> {
    let state = app.state::<FusionState>().0.lock().map_err(|_| FusionError::Unsupported)?.clone();
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
                    let binary = wine_binary_for(&app, &bottle.runtime);
            crate::wine::prefix::init_prefix(&binary, Path::new(&bottle.path))?;
            Ok("Prefix initialized.".into())
        }
        FixIntent::InstallDependency(verb) => {
            let st = app.state::<FusionState>();
            let bottle = st.with_state(|s| s.applications.iter().find(|a| a.id == app_id).and_then(|a| s.bottles.iter().find(|b| b.id == a.bottle_id)).cloned().ok_or(FusionError::BottleNotFound))?;
                    let binary = wine_binary_for(&app, &bottle.runtime);
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
    }
}

/* ---------- snapshots ---------- */

#[tauri::command]
pub fn create_snapshot(app: AppHandle, bottle_id: String, name: String) -> Result<Snapshot, FusionError> {
    let d = dirs(&app);
    let st = app.state::<FusionState>();
    let bottle = st.with_state(|s| s.bottles.iter().find(|b| b.id == bottle_id).cloned().ok_or(FusionError::BottleNotFound))?;
    let (archive_path, size) = crate::snapshots::create_snapshot(&d.bottles, &d.snapshots, &bottle)?;
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
        let snap = s.snapshots.iter().find(|x| x.id == snapshot_id).cloned().ok_or(FusionError::Unsupported)?;
        let b = s.bottles.iter().find(|b| b.id == snap.bottle_id).cloned().ok_or(FusionError::BottleNotFound)?;
        Ok((b, snap))
    })?;
    crate::snapshots::restore_snapshot(&d.snapshots, Path::new(&snap.path), &bottle)?;
    Ok(())
}

#[tauri::command]
pub fn delete_snapshot(app: AppHandle, snapshot_id: String) -> Result<(), FusionError> {
    let d = dirs(&app);
    let st = app.state::<FusionState>();
    let snap = st.with_state(|s| s.snapshots.iter().find(|x| x.id == snapshot_id).cloned().ok_or(FusionError::Unsupported))?;
    crate::snapshots::delete_snapshot(&d.snapshots, Path::new(&snap.path))?;
    st.with_state(|s| {
        s.snapshots.retain(|x| x.id != snapshot_id);
        Ok(())
    })?;
    st.save(&app)?;
    Ok(())
}

/* ---------- runtimes ---------- */

#[tauri::command]
pub fn import_runtime(app: AppHandle, name: String, archive_path: String) -> Result<Runtime, FusionError> {
    let d = dirs(&app);
    let source = Path::new(&archive_path);
    if !source.is_file() {
        return Err(FusionError::InvalidExecutable);
    }
    // Stage into our own downloads dir before touching anything.
    let staged = d.downloads.join(format!("{}.pkg", new_id()));
    let mut ext = source.extension().map(|e| e.to_string_lossy().into_owned()).unwrap_or_default();
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
    let rt = st.with_state(|s| s.runtimes.iter().find(|r| r.id == runtime_id).cloned().ok_or(FusionError::RuntimeNotFound))?;
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
            s.settings.push(("safe_mode".into(), if enabled { "on" } else { "off" }.into()));
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
    let bundle_path = crate::exporter::create_mac_app_bundle(&application.name, &application.id, &target_dir)?;
    Ok(bundle_path.to_string_lossy().into_owned())
}