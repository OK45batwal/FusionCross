use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

use crate::core::errors::FusionError;
use crate::core::ids::new_id;
use crate::core::paths;
use crate::core::state::{Application, Bottle};
use crate::core::templates;
use crate::manager::{dirs, FusionState, Jobs};
use crate::process::ProcessManager;

use super::{build_wine_execution_context, now_ts, settings_bool, wine_binary_for};

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

/// Automatically deploy hardware-accelerated graphics libraries (DXMT/Metal) into bottle system directories.
/// Compares sizes to overwrite stub DLLs created during prefix initialization.
pub fn deploy_graphics_libraries(app: &AppHandle, prefix: &Path) {
    let d = dirs(app);
    let dxmt_x64 = d.libraries.join("Libraries/DXMT/x64");
    let dxmt_x32 = d.libraries.join("Libraries/DXMT/x32");
    let sys32 = prefix.join("drive_c/windows/system32");
    let syswow64 = prefix.join("drive_c/windows/syswow64");

    let copy_if_different = |src: &Path, dst: &Path| {
        if !src.exists() {
            return;
        }
        let should_copy = match (std::fs::metadata(src), std::fs::metadata(dst)) {
            (Ok(s), Ok(d)) => s.len() != d.len(),
            (Ok(_), Err(_)) => true,
            _ => false,
        };
        if should_copy {
            let _ = std::fs::copy(src, dst);
        }
    };

    if dxmt_x64.exists() && sys32.exists() {
        for name in &[
            "d3d10core.dll",
            "d3d11.dll",
            "dxgi.dll",
            "winemetal.dll",
            "nvapi64.dll",
            "nvngx.dll",
        ] {
            let src = dxmt_x64.join(name);
            let dst = sys32.join(name);
            copy_if_different(&src, &dst);
        }
    }

    if dxmt_x32.exists() && syswow64.exists() {
        for name in &["d3d10core.dll", "d3d11.dll", "dxgi.dll", "winemetal.dll"] {
            let src = dxmt_x32.join(name);
            let dst = syswow64.join(name);
            copy_if_different(&src, &dst);
        }
    }
}

pub fn initialize_bottle_prefix(app: &AppHandle, bottle_id: &str) -> Result<String, FusionError> {
    let st = app.state::<FusionState>();
    let bottle = st
        .with_state(|s| Ok(s.bottles.iter().find(|b| b.id == bottle_id).cloned()))?
        .ok_or(FusionError::BottleNotFound)?;
    let binary = wine_binary_for(app, &bottle.runtime)?;
    let prefix = Path::new(&bottle.path);
    crate::wine::prefix::init_prefix(&binary, prefix)?;
    deploy_graphics_libraries(app, prefix);
    crate::wine::prefix::ensure_graphics_registry(prefix, &bottle.graphics).ok();
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
    deploy_graphics_libraries(&app, prefix);
    crate::wine::prefix::ensure_graphics_registry(prefix, &bottle.graphics).ok();

    let safe = settings_bool(&app, "safe_mode");
    let (override_env, dll_overrides) = build_wine_execution_context(&binary, &bottle, safe);

    let mut cmd = std::process::Command::new(&binary);
    cmd.env("WINEPREFIX", prefix);
    cmd.env("WINEDLLOVERRIDES", &dll_overrides);
    for (k, v) in override_env {
        cmd.env(k, v);
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

#[tauri::command]
pub fn install_gaming_essentials(app: AppHandle, bottle_id: String) -> Result<String, FusionError> {
    let verbs = vec![
        "vcrun2022".to_string(),
        "d3dx9".to_string(),
        "d3dcompiler_47".to_string(),
        "corefonts".to_string(),
    ];
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
    let job = jobs.begin(format!("Installing Gaming Essentials into {}", bottle.name));
    let job_id = job.clone();
    let handle = app.clone();
    let bottle_id_clone = bottle_id.clone();

    std::thread::spawn(move || {
        let jobs = handle.state::<Jobs>();
        match crate::wine::prefix::install_verbs(&binary, &prefix, &verbs) {
            Ok(()) => {
                let st = handle.state::<FusionState>();
                let _ = st.with_state(|s| {
                    if let Some(b) = s.bottles.iter_mut().find(|b| b.id == bottle_id_clone) {
                        for v in &verbs {
                            if !b.dependencies.contains(v) {
                                b.dependencies.push(v.clone());
                            }
                        }
                    }
                    Ok(())
                });
                let _ = st.save(&handle);
                jobs.finish(
                    &job_id,
                    "Installed Gaming Essentials (DirectX, VC++ 2022, Core Fonts).".into(),
                );
            }
            Err(e) => jobs.fail(&job_id, format!("Gaming Essentials install failed: {e}")),
        }
    });
    Ok(job)
}
