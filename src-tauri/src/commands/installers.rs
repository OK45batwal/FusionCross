#![allow(dead_code)]

use std::path::Path;
use tauri::{AppHandle, Manager};

use crate::compatibility;
use crate::core::errors::FusionError;
use crate::core::ids::new_id;
use crate::core::state::Application;
use crate::installer::{self, InstallerAnalysis};
use crate::manager::{FusionState, Jobs};
use crate::wine::scanner::{self, DiscoveredExe};

use super::bottles::initialize_bottle_prefix;
use super::{build_wine_execution_context, wine_binary_for};

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
            let full_path = Path::new(&bottle.path)
                .join(&exe.rel_path)
                .to_string_lossy()
                .into_owned();
            if !s
                .applications
                .iter()
                .any(|a| a.bottle_id == bottle_id && a.executable_path == full_path)
            {
                let rec = compatibility::recommend(&exe.name);
                let icon_data = crate::wine::icon::extract_icon_data_url(Path::new(&full_path));
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
                    icon_data,
                    launch_arguments: None,
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
                let full_path = Path::new(&bottle.path)
                    .join(&exe.rel_path)
                    .to_string_lossy()
                    .into_owned();
                if !s.applications.iter().any(|a| {
                    a.bottle_id == bottle.id
                        && (a.executable_path == full_path || a.name == exe.name)
                }) {
                    let rec = compatibility::recommend(&exe.name);
                    let icon_data = crate::wine::icon::extract_icon_data_url(Path::new(&full_path));
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
                        icon_data,
                        launch_arguments: None,
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
pub fn extract_installer_icon(path: String) -> Result<Option<String>, FusionError> {
    Ok(crate::wine::icon::extract_icon_data_url(Path::new(&path)))
}

#[tauri::command]
pub fn run_installer(
    app: AppHandle,
    installer_path: String,
    bottle_id: String,
) -> Result<String, FusionError> {
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

pub fn install_job(
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

    let (override_env, dll_overrides) = build_wine_execution_context(&binary, &bottle, false);
    let mut cmd = std::process::Command::new(&binary);
    cmd.env("WINEPREFIX", prefix);
    cmd.env("WINEDLLOVERRIDES", &dll_overrides);
    for (k, v) in override_env {
        cmd.env(k, v);
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
                icon_data: crate::wine::icon::extract_icon_data_url(&prefix.join(&exe.rel_path)),
                launch_arguments: None,
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
