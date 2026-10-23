#![allow(dead_code)]

use serde::Serialize;
use std::path::Path;
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, Manager};

use crate::compatibility;
use crate::core::errors::FusionError;
use crate::core::ids::new_id;
use crate::core::paths;
use crate::core::state::Application;
use crate::manager::{bottle_prefix, dirs, FusionState};
use crate::process::{ProcessManager, RunningInfo};

use super::bottles::deploy_graphics_libraries;
use super::{build_wine_execution_context, now_ts, settings_bool, settings_value, wine_binary_for};

#[derive(Debug, Clone, Serialize)]
#[allow(dead_code)]
pub struct LogEntry {
    pub id: String,
    pub filename: String,
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
        return Err(FusionError::AlreadyRunning);
    }
    let binary = wine_binary_for(&app, &bottle.runtime)?;
    let d = dirs(&app);
    let prefix = bottle_prefix(&d.bottles, &bottle)?;
    let executable_relative = Path::new(&application.executable_path)
        .strip_prefix(Path::new(&bottle.path))
        .or_else(|_| Path::new(&application.executable_path).strip_prefix(&prefix))
        .map_err(|_| FusionError::InvalidPath)?
        .to_str()
        .ok_or(FusionError::InvalidPath)?;
    let executable = paths::safe_file(&prefix, executable_relative)?;
    if !crate::wine::prefix::prefix_prepared(&prefix) {
        crate::wine::prefix::init_prefix(&binary, &prefix)?;
    }
    let safe = settings_bool(&app, "safe_mode");
    if !safe {
        deploy_graphics_libraries(&app, &prefix);
        crate::wine::prefix::ensure_graphics_registry(&prefix, &bottle.graphics).ok();
    }

    let hud = settings_value(&app, "dxvk_hud").unwrap_or_else(|| "compiler,fps".into());
    let (mut override_env, dll_overrides) =
        build_wine_execution_context(&binary, &bottle, safe, &hud);

    // Detect launch arguments: Unreal Engine games (like Raji) benefit from -dx11 to force D3D11 RHI
    let mut launch_args = Vec::new();
    let lower_exe = executable.to_string_lossy().to_lowercase();
    let lower_name = application.name.to_lowercase();
    let is_unreal_engine = lower_exe.contains("raji")
        || lower_name.contains("raji")
        || lower_exe.ends_with("-win64-shipping.exe")
        || lower_exe.contains("ue4")
        || executable
            .parent()
            .and_then(|p| p.parent())
            .map(|p| p.join("Engine").exists())
            .unwrap_or(false);

    if is_unreal_engine {
        launch_args.push("-dx11".to_string());
    }

    // Steam Client fixes: Chromium CEF sandbox & GPU acceleration crash in Wine on macOS.
    // -no-cef-sandbox disables Windows token sandboxing which Wine cannot emulate
    // -cef-disable-gpu disables hardware CEF rendering preventing webhelper crashes
    // -cef-disable-hang-monitor prevents Steam from killing steamwebhelper when Wine IPC lags
    let is_steam = lower_exe.ends_with("steam.exe") || lower_name == "steam";
    if is_steam {
        // Prevent CEF / Chromium crash reporter from allocating nested signal stacks
        override_env.push(("CHROME_CRASHPAD_PIPE_NAME".into(), "".into()));
        override_env.push(("BREAKPAD_DUMP_LOCATION".into(), "/dev/null".into()));
        override_env.push(("CEF_USE_SANDBOX".into(), "0".into()));

        // Steam Wine / Proton environment variables
        override_env.push((
            "STEAM_COMPAT_DATA_PATH".into(),
            prefix.to_string_lossy().into_owned(),
        ));
        override_env.push(("SteamAppId".into(), "0".into()));
        override_env.push(("WINE_LARGE_ADDRESS_AWARE".into(), "1".into()));
        override_env.push((
            "DXVK_STATE_CACHE_PATH".into(),
            prefix.to_string_lossy().into_owned(),
        ));

        if let Some(parent) = executable.parent() {
            override_env.push((
                "STEAM_COMPAT_CLIENT_INSTALL_PATH".into(),
                parent.to_string_lossy().into_owned(),
            ));
        }

        // Clean stale htmlcache lockfiles that cause CEF IPC deadlocks and hangs
        if let Ok(users) = std::fs::read_dir(prefix.join("drive_c").join("users")) {
            for user in users.flatten() {
                let lockfile = user.path().join("AppData/Local/Steam/htmlcache/lockfile");
                if lockfile.is_file() {
                    let _ = std::fs::remove_file(lockfile);
                }
            }
        }

        // Only the sandbox flag is safe. Steam's later builds create the CEF
        // helper fine without it, but `-cef-disable-gpu*`, `-allpackagedcontent`,
        // `-noverifyfiles`, and `-allosarches` leave steamwebhelper in a
        // message-window crash loop, so the UI never opens.
        launch_args.push("-no-cef-sandbox".to_string());
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
    let log_path = d.logs.join(format!("{}_{}.log", app_id, now_ts()));
    let prefix_string = prefix.to_string_lossy().into_owned();
    let executable_string = executable.to_string_lossy().into_owned();

    let info = pm.spawn(
        &app_id,
        &bottle.id,
        &application.name,
        &binary,
        &prefix_string,
        &executable_string,
        &launch_args,
        &override_env,
        &dll_overrides,
        Some(&log_path),
    )?;

    // Record the launch.
    st.update(|s| {
        if let Some(a) = s.applications.iter_mut().find(|a| a.id == app_id) {
            a.launch_count += 1;
            a.last_played = Some(now_ts());
        }
        if let Some(b) = s.bottles.iter_mut().find(|b| b.id == bottle.id) {
            b.last_used_at = Some(now_ts());
        }
        Ok(())
    })?;
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
    st.update(|s| {
        let a = s
            .applications
            .iter_mut()
            .find(|a| a.id == app_id)
            .ok_or(FusionError::ApplicationNotFound)?;
        a.favorite = !a.favorite;
        Ok(())
    })
}

#[tauri::command]
pub fn register_application(
    app: AppHandle,
    bottle_id: String,
    name: String,
    executable_rel_path: String,
    category: String,
) -> Result<Application, FusionError> {
    super::validation::name(&name)?;
    super::validation::choice(
        &category,
        &["games", "applications", "productivity", "utilities"],
    )?;
    let st = app.state::<FusionState>();
    let bottle = st.with_state(|s| {
        s.bottles
            .iter()
            .find(|b| b.id == bottle_id)
            .cloned()
            .ok_or(FusionError::BottleNotFound)
    })?;
    let prefix = bottle_prefix(&dirs(&app).bottles, &bottle)?;
    let executable_path = paths::safe_file(&prefix, &executable_rel_path)?
        .to_string_lossy()
        .into_owned();
    let rec = compatibility::recommend(&name);
    let icon_data = crate::wine::icon::extract_icon_data_url(Path::new(&executable_path));
    let application = st.update(|s| {
        if let Some(existing) = s.applications.iter_mut().find(|a| {
            a.bottle_id == bottle_id
                && paths::same_file(Path::new(&a.executable_path), Path::new(&executable_path))
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
    Ok(application)
}

#[tauri::command]
pub fn unregister_application(app: AppHandle, app_id: String) -> Result<(), FusionError> {
    let st = app.state::<FusionState>();
    st.update(|s| {
        s.applications.retain(|a| a.id != app_id);
        Ok(())
    })?;
    Ok(())
}

#[tauri::command]
#[allow(dead_code)]
pub fn update_application(
    app: AppHandle,
    app_id: String,
    name: Option<String>,
    launch_arguments: Option<String>,
    category: Option<String>,
) -> Result<Application, FusionError> {
    if let Some(value) = &name {
        super::validation::name(value)?;
    }
    if let Some(value) = &category {
        super::validation::choice(
            value,
            &["applications", "games", "productivity", "utilities"],
        )?;
    }
    if launch_arguments.as_ref().is_some_and(|v| v.contains('\0')) {
        return Err(FusionError::InvalidInput);
    }
    let st = app.state::<FusionState>();
    let updated = st.update(|s| {
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
    Ok(updated)
}

#[tauri::command]
#[allow(dead_code)]
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
            if let Ok(metadata) = std::fs::symlink_metadata(&path) {
                if !metadata.file_type().is_file() {
                    continue;
                }
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
                        id: filename.clone(),
                        filename,
                        size_bytes: meta.len(),
                        modified_at,
                    });
                }
            }
        }
    }
    entries.sort_by_key(|entry| std::cmp::Reverse(entry.modified_at));
    Ok(entries)
}

#[tauri::command]
#[allow(dead_code)]
pub fn read_log_file(app: AppHandle, log_id: String) -> Result<String, FusionError> {
    let path = resolve_log_file(&dirs(&app).logs, &log_id)?;
    read_log_tail(&path, 200_000)
}

/// Last `limit` bytes of a log. Decoded lossily: cutting on a byte boundary
/// can split a multi-byte character, which must not blank the whole tail.
fn read_log_tail(path: &Path, limit: u64) -> Result<String, FusionError> {
    let metadata = std::fs::metadata(path).map_err(|_| FusionError::Unsupported)?;
    if metadata.len() <= limit {
        return Ok(String::from_utf8_lossy(
            &std::fs::read(path).map_err(|_| FusionError::Unsupported)?,
        )
        .into_owned());
    }
    use std::io::{Read, Seek, SeekFrom};
    let mut file = std::fs::File::open(path).map_err(|_| FusionError::Unsupported)?;
    file.seek(SeekFrom::End(-(limit as i64)))
        .map_err(|_| FusionError::Unsupported)?;
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer)
        .map_err(|_| FusionError::Unsupported)?;
    Ok(format!(
        "... [earlier output truncated] ...\n{}",
        String::from_utf8_lossy(&buffer)
    ))
}

fn resolve_log_file(logs_dir: &Path, log_id: &str) -> Result<std::path::PathBuf, FusionError> {
    if !log_id.ends_with(".log") {
        return Err(FusionError::InvalidPath);
    }
    paths::safe_file(logs_dir, log_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::ids::new_id;

    #[test]
    fn log_reader_is_confined_to_the_logs_directory() {
        let logs = std::env::temp_dir().join(format!("fusioncross_logs_{}", new_id()));
        std::fs::create_dir_all(&logs).unwrap();
        std::fs::write(logs.join("app_1.log"), "ok").unwrap();

        assert!(resolve_log_file(&logs, "app_1.log").is_ok());
        assert!(resolve_log_file(&logs, "../state.json").is_err());
        assert!(resolve_log_file(&logs, "/etc/passwd").is_err());
        std::fs::remove_dir_all(logs).ok();
    }

    #[test]
    fn log_tail_survives_a_utf8_boundary_split() {
        let path = std::env::temp_dir().join(format!("fusioncross_tail_{}.log", new_id()));
        let mut content = String::from("é").repeat(150_000);
        content.push_str("LATEST LINE");
        std::fs::write(&path, &content).unwrap();

        let tail = read_log_tail(&path, 200_000).unwrap();
        assert!(tail.contains("LATEST LINE"));
        assert!(tail.starts_with("... [earlier output truncated]"));
        std::fs::remove_file(path).ok();
    }
}
