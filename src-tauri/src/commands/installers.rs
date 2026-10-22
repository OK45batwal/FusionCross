#![allow(dead_code)]

use std::path::Path;
use tauri::{AppHandle, Manager};

use crate::compatibility;
use crate::core::errors::FusionError;
use crate::core::ids::new_id;
use crate::core::state::{AppState, Application};
use crate::installer::{self, InstallerAnalysis};
use crate::manager::{FusionState, Jobs};
use crate::wine::scanner::{self, DiscoveredExe};

use super::{build_wine_execution_context, wine_binary_for};
use crate::process::job::JobControl;

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
    st.update(|s| {
        register_discovered(s, &bottle_id, Path::new(&bottle.path), &found);
        Ok(())
    })?;
    Ok(found)
}

#[tauri::command]
pub fn scan_all_bottles(app: AppHandle) -> Result<usize, FusionError> {
    let st = app.state::<FusionState>();
    let bottles = st.with_state(|s| Ok(s.bottles.clone()))?;
    let mut total_added = 0;

    for bottle in &bottles {
        let found = scanner::scan_prefix(Path::new(&bottle.path));
        st.update(|s| {
            total_added += register_discovered(s, &bottle.id, Path::new(&bottle.path), &found);
            Ok(())
        })?;
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
    let (job, control) = jobs.begin_cancellable(format!("Installing {}", analysis.file_name));
    let job_id = job.clone();
    let handle = app.clone();

    crate::manager::spawn_job(handle.clone(), job_id.clone(), move || {
        let jobs = handle.state::<Jobs>();
        let outcome = install_job(
            &handle,
            &bottle_id,
            &installer_path,
            &analysis.file_name,
            &[],
            &control,
        );
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
    extra_dependencies: &[String],
    control: &JobControl,
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

    control.check()?;
    if !crate::wine::prefix::prefix_prepared(prefix) {
        let status = control.run(
            std::process::Command::new(&binary)
                .env("WINEPREFIX", prefix)
                .env("WINEDLLOVERRIDES", "mscoree,mshtml=")
                .args(["wineboot", "-i"]),
        )?;
        if !status.success() {
            return Err(FusionError::InstallationFailed);
        }
    }
    let safe = super::settings_bool(app, "safe_mode");
    if !safe {
        super::bottles::deploy_graphics_libraries(app, prefix);
        crate::wine::prefix::ensure_graphics_registry(prefix, &bottle.graphics).ok();
    }
    let mut dependencies = bottle.dependencies.clone();
    for dependency in extra_dependencies {
        if !dependencies.contains(dependency) {
            dependencies.push(dependency.clone());
        }
    }
    crate::wine::prefix::install_verbs_cancellable(&binary, prefix, &dependencies, control)?;

    // Copy the installer into the prefix so Wine can reach it.
    let target_dir = prefix.join("drive_c").join("installers");
    std::fs::create_dir_all(&target_dir).map_err(|_| FusionError::PermissionDenied)?;
    let target = target_dir.join(file_name);
    std::fs::copy(installer_path, &target).map_err(|_| FusionError::InvalidExecutable)?;

    let (override_env, dll_overrides) = build_wine_execution_context(&binary, &bottle, safe);
    let mut cmd = std::process::Command::new(&binary);
    cmd.env("WINEPREFIX", prefix);
    cmd.env("WINEDLLOVERRIDES", &dll_overrides);
    for (k, v) in override_env {
        cmd.env(k, v);
    }
    let status = control.run(installer_command(&mut cmd, &target))?;
    if !status.success() {
        return Err(FusionError::InstallationFailed);
    }

    // Discover whatever the installer laid down.
    let found = scanner::scan_prefix(prefix);
    control.seal()?;
    let registered = st.update(|s| Ok(register_discovered(s, bottle_id, prefix, &found)))?;
    Ok(format!(
        "Installed. Discovered {registered} application(s)."
    ))
}

/// `.msi` packages are databases, not executables — Wine runs them through
/// `msiexec`. Everything else is handed to Wine directly.
pub(crate) fn installer_command<'a>(
    cmd: &'a mut std::process::Command,
    target: &Path,
) -> &'a mut std::process::Command {
    if target
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("msi"))
    {
        cmd.args(["msiexec", "/i"]);
    }
    cmd.arg(target)
}

pub(crate) fn register_discovered(
    state: &mut AppState,
    bottle_id: &str,
    prefix: &Path,
    found: &[DiscoveredExe],
) -> usize {
    let mut added = 0;
    for exe in found {
        let full_path = prefix.join(&exe.rel_path);
        if state.applications.iter().any(|a| {
            a.bottle_id == bottle_id
                && crate::core::paths::same_file(Path::new(&a.executable_path), &full_path)
        }) {
            continue;
        }
        let rec = compatibility::recommend(&exe.name);
        state.applications.push(Application {
            id: new_id(),
            bottle_id: bottle_id.into(),
            name: exe.name.clone(),
            executable_path: full_path.to_string_lossy().into_owned(),
            category: exe.category.clone(),
            favorite: false,
            launch_count: 0,
            play_time_mins: 0,
            last_played: None,
            compatibility: Some(rec.compatibility),
            profile: Some(rec.profile.into()),
            icon_data: crate::wine::icon::extract_icon_data_url(&full_path),
            launch_arguments: None,
        });
        added += 1;
    }
    added
}

#[tauri::command]
pub fn list_jobs(app: AppHandle) -> Result<Vec<crate::manager::Job>, FusionError> {
    Ok(app.state::<Jobs>().list())
}

#[tauri::command]
pub fn cancel_job(app: AppHandle, job_id: String) -> Result<(), FusionError> {
    app.state::<Jobs>().cancel(&job_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn msi_packages_are_opened_through_msiexec() {
        let mut exe = std::process::Command::new("wine");
        let args: Vec<_> = installer_command(&mut exe, Path::new("/tmp/setup.exe"))
            .get_args()
            .map(|arg| arg.to_string_lossy().into_owned())
            .collect();
        assert_eq!(args, ["/tmp/setup.exe"]);

        let mut msi = std::process::Command::new("wine");
        let args: Vec<_> = installer_command(&mut msi, Path::new("/tmp/setup.MSI"))
            .get_args()
            .map(|arg| arg.to_string_lossy().into_owned())
            .collect();
        assert_eq!(args, ["msiexec", "/i", "/tmp/setup.MSI"]);
    }

    #[test]
    fn repeated_discovery_preserves_metadata_and_distinct_same_named_apps() {
        let mut state = AppState::default();
        let found = vec![
            DiscoveredExe {
                name: "Game".into(),
                rel_path: "drive_c/One/game.exe".into(),
                category: "games".into(),
            },
            DiscoveredExe {
                name: "Game".into(),
                rel_path: "drive_c/Two/game.exe".into(),
                category: "games".into(),
            },
        ];
        let prefix = Path::new("/nonexistent-fusioncross-test/bottle");
        assert_eq!(register_discovered(&mut state, "bottle", prefix, &found), 2);
        state.applications[0].favorite = true;
        state.applications[0].play_time_mins = 42;
        let id = state.applications[0].id.clone();
        assert_eq!(register_discovered(&mut state, "bottle", prefix, &found), 0);
        assert_eq!(state.applications.len(), 2);
        assert_eq!(state.applications[0].id, id);
        assert!(state.applications[0].favorite);
        assert_eq!(state.applications[0].play_time_mins, 42);
    }
}
