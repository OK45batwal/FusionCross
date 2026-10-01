use std::path::Path;
use std::time::UNIX_EPOCH;
use serde::Serialize;
use tauri::{AppHandle, Manager};

use crate::compatibility;
use crate::core::errors::FusionError;
use crate::core::ids::new_id;
use crate::core::state::Application;
use crate::manager::{dirs, FusionState};
use crate::process::{ProcessManager, RunningInfo};

use super::bottles::deploy_graphics_libraries;
use super::{build_wine_execution_context, now_ts, settings_bool, wine_binary_for};

#[derive(Debug, Clone, Serialize)]
pub struct LogEntry {
    pub filename: String,
    pub path: String,
    pub size_bytes: u64,
    pub modified_at: u64,
}

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
    deploy_graphics_libraries(&app, prefix);
    crate::wine::prefix::ensure_graphics_registry(prefix, &bottle.graphics).ok();

    let safe = settings_bool(&app, "safe_mode");
    let (override_env, dll_overrides) = build_wine_execution_context(&binary, &bottle, safe);

    // Detect launch arguments: Unreal Engine games (like Raji) benefit from -dx11 to force D3D11 RHI
    let mut launch_args = Vec::new();
    let lower_exe = application.executable_path.to_lowercase();
    let lower_name = application.name.to_lowercase();
    let is_unreal_engine = lower_exe.contains("raji")
        || lower_name.contains("raji")
        || lower_exe.ends_with("-win64-shipping.exe")
        || lower_exe.contains("ue4")
        || Path::new(&application.executable_path)
            .parent()
            .and_then(|p| p.parent())
            .map(|p| p.join("Engine").exists())
            .unwrap_or(false);

    if is_unreal_engine {
        launch_args.push("-dx11".to_string());
    }

    // Append any user-defined custom launch arguments
    if let Some(ref custom_args) = application.launch_arguments {
        for arg in custom_args.split_whitespace() {
            if !arg.is_empty() {
                launch_args.push(arg.to_string());
            }
        }
    }

    // Configure dedicated stdout/stderr log capture
    let d = dirs(&app);
    let log_path = d.logs.join(format!("{}_{}.log", app_id, now_ts()));

    let info = pm.spawn(
        &app_id,
        &bottle.id,
        &application.name,
        &binary,
        &bottle.path,
        &application.executable_path,
        &launch_args,
        &override_env,
        &dll_overrides,
        Some(&log_path),
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
    let icon_data = crate::wine::icon::extract_icon_data_url(Path::new(&executable_path));
    let application = st.with_state(|s| {
        if let Some(existing) = s.applications.iter_mut().find(|a| {
            a.bottle_id == bottle_id && (a.executable_path == executable_path || a.name == name)
        }) {
            existing.executable_path = executable_path;
            existing.name = name;
            if existing.icon_data.is_none() {
                existing.icon_data = icon_data;
            }
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
            icon_data,
            launch_arguments: None,
        };
        s.applications.push(app.clone());
        Ok(app)
    })?;
    st.save(&app)?;
    Ok(application)
}

#[tauri::command]
pub fn unregister_application(app: AppHandle, app_id: String) -> Result<(), FusionError> {
    let st = app.state::<FusionState>();
    st.with_state(|s| {
        s.applications.retain(|a| a.id != app_id);
        Ok(())
    })?;
    st.save(&app)?;
    Ok(())
}

#[tauri::command]
pub fn update_application(
    app: AppHandle,
    app_id: String,
    name: Option<String>,
    launch_arguments: Option<String>,
    category: Option<String>,
) -> Result<Application, FusionError> {
    let st = app.state::<FusionState>();
    let updated = st.with_state(|s| {
        let app = s
            .applications
            .iter_mut()
            .find(|a| a.id == app_id)
            .ok_or(FusionError::ApplicationNotFound)?;
        if let Some(n) = name {
            if !n.trim().is_empty() {
                app.name = n.trim().to_string();
            }
        }
        if let Some(args) = launch_arguments {
            app.launch_arguments = if args.trim().is_empty() {
                None
            } else {
                Some(args.trim().to_string())
            };
        }
        if let Some(cat) = category {
            app.category = cat;
        }
        Ok(app.clone())
    })?;
    st.save(&app)?;
    Ok(updated)
}

#[tauri::command]
pub fn list_application_logs(
    app: AppHandle,
    app_id: Option<String>,
) -> Result<Vec<LogEntry>, FusionError> {
    let d = dirs(&app);
    if !d.logs.exists() {
        return Ok(Vec::new());
    }
    let mut entries = Vec::new();
    if let Ok(dir_entries) = std::fs::read_dir(&d.logs) {
        for entry in dir_entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                let filename = path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                if let Some(ref aid) = app_id {
                    if !filename.starts_with(aid) {
                        continue;
                    }
                }
                if let Ok(meta) = entry.metadata() {
                    let modified_at = meta
                        .modified()
                        .ok()
                        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                        .map(|d| d.as_secs())
                        .unwrap_or(0);
                    entries.push(LogEntry {
                        filename,
                        path: path.to_string_lossy().into_owned(),
                        size_bytes: meta.len(),
                        modified_at,
                    });
                }
            }
        }
    }
    entries.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
    Ok(entries)
}

#[tauri::command]
pub fn read_log_file(_app: AppHandle, log_path: String) -> Result<String, FusionError> {
    let path = Path::new(&log_path);
    if !path.exists() {
        return Err(FusionError::ApplicationNotFound);
    }
    let metadata = std::fs::metadata(path).map_err(|_| FusionError::Unsupported)?;
    let content = if metadata.len() > 200_000 {
        use std::io::{Read, Seek, SeekFrom};
        let mut f = std::fs::File::open(path).map_err(|_| FusionError::Unsupported)?;
        f.seek(SeekFrom::End(-200_000))
            .map_err(|_| FusionError::Unsupported)?;
        let mut buffer = String::new();
        f.read_to_string(&mut buffer).unwrap_or_default();
        format!("... [earlier output truncated] ...\n{}", buffer)
    } else {
        std::fs::read_to_string(path).unwrap_or_default()
    };
    Ok(content)
}
