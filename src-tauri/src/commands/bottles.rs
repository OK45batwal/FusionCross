#![allow(dead_code)]

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
    super::validation::name(&name)?;
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
        st.update(|s| {
            s.bottles.push(bottle.clone());
            Ok(())
        })?;
    }

    // Initialize the prefix as a background job so the UI stays fast.
    let jobs = app.state::<Jobs>();
    let job = jobs.begin("Initializing bottle prefix".to_string());
    let job_id = job.clone();
    let handle = app.clone();
    let bottle_id_init = bottle.id.clone();
    crate::manager::spawn_job(handle.clone(), job_id.clone(), move || {
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

    // Deploy SDL2.dll for tools like gldriverquery if found in mono or runtime packages
    let home = std::env::var("HOME").unwrap_or_default();
    let home_path = PathBuf::from(&home);
    let sdl2_candidates = [
        home_path.join("Library/Application Support/FusionCross/runtimes/whisky-wine/share/wine/mono/wine-mono-7.4.1/lib"),
        home_path.join("Library/Application Support/heroic/tools/wine/Wine-Crossover-latest/Contents/Resources/wine/share/wine/mono/wine-mono-9.0.0/lib"),
        d.runtimes.join("whisky-wine/share/wine/mono/wine-mono-7.4.1/lib"),
    ];

    for dir in &sdl2_candidates {
        if !dir.exists() {
            continue;
        }
        let src32_1 = dir.join("SDL2-x86.dll");
        let src32_2 = dir.join("x86/SDL2.dll");
        let src32 = if src32_1.exists() {
            Some(src32_1)
        } else if src32_2.exists() {
            Some(src32_2)
        } else {
            None
        };

        if let Some(src) = src32 {
            if syswow64.exists() {
                copy_if_different(&src, &syswow64.join("SDL2.dll"));
            }
            let steam_bin = prefix.join("drive_c/Program Files (x86)/Steam/bin");
            if steam_bin.exists() {
                copy_if_different(&src, &steam_bin.join("SDL2.dll"));
            }
        }

        let src64_1 = dir.join("SDL2-x86_64.dll");
        let src64_2 = dir.join("x86_64/SDL2.dll");
        let src64 = if src64_1.exists() {
            Some(src64_1)
        } else if src64_2.exists() {
            Some(src64_2)
        } else {
            None
        };

        if let Some(src) = src64 {
            if sys32.exists() {
                copy_if_different(&src, &sys32.join("SDL2.dll"));
            }
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
    st.update(|s| {
        s.bottles.retain(|b| b.id != bottle_id);
        s.applications.retain(|a| a.bottle_id != bottle_id);
        s.snapshots.retain(|x| x.bottle_id != bottle_id);
        Ok(())
    })?;
    Ok(())
}

#[tauri::command]
pub fn clone_bottle(
    app: AppHandle,
    bottle_id: String,
    new_name: String,
) -> Result<Bottle, FusionError> {
    super::validation::name(&new_name)?;
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
    let apps_to_clone = apps_to_clone
        .into_iter()
        .map(|mut application| {
            application.executable_path = rebase_executable(
                Path::new(&source.path),
                &new_path,
                Path::new(&application.executable_path),
            )?
            .to_string_lossy()
            .into_owned();
            Ok(application)
        })
        .collect::<Result<Vec<_>, FusionError>>()?;
    paths::safe_copy_all(&d.bottles, Path::new(&source.path), &new_path)?;

    let clone = Bottle {
        id: id.clone(),
        name: new_name,
        path: new_path.to_string_lossy().into_owned(),
        created_at: now_ts(),
        last_used_at: None,
        ..source.clone()
    };
    let saved = st.update(|s| {
        s.bottles.push(clone.clone());
        for app_rec in apps_to_clone {
            s.applications.push(Application {
                id: new_id(),
                bottle_id: id.clone(),
                launch_count: 0,
                play_time_mins: 0,
                last_played: None,
                ..app_rec
            });
        }
        Ok(())
    });
    if let Err(error) = saved {
        let _ = paths::safe_remove_all(&d.bottles, &new_path);
        return Err(error);
    }
    Ok(clone)
}

fn rebase_executable(
    source: &Path,
    destination: &Path,
    executable: &Path,
) -> Result<PathBuf, FusionError> {
    let canonical_source = source
        .canonicalize()
        .unwrap_or_else(|_| source.to_path_buf());
    let relative = executable
        .strip_prefix(source)
        .or_else(|_| executable.strip_prefix(&canonical_source))
        .map_err(|_| FusionError::InvalidPath)?;
    if relative.as_os_str().is_empty()
        || relative
            .components()
            .any(|c| !matches!(c, std::path::Component::Normal(_)))
    {
        return Err(FusionError::InvalidPath);
    }
    Ok(destination.join(relative))
}

#[cfg(test)]
mod clone_tests {
    use super::*;

    #[test]
    fn clone_rebases_path_components_and_rejects_lookalikes() {
        let source = Path::new("/bottles/source/");
        let dest = Path::new("/bottles/clone");
        assert_eq!(
            rebase_executable(source, dest, Path::new("/bottles/source/drive_c/app.exe")).unwrap(),
            dest.join("drive_c/app.exe")
        );
        assert!(
            rebase_executable(source, dest, Path::new("/bottles/source-other/app.exe")).is_err()
        );
        assert!(
            rebase_executable(source, dest, Path::new("/bottles/source/../other/app.exe")).is_err()
        );
    }
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
pub fn reveal_application_in_finder(app: AppHandle, app_id: String) -> Result<(), FusionError> {
    let st = app.state::<FusionState>();
    let application = st.with_state(|s| {
        s.applications
            .iter()
            .find(|a| a.id == app_id)
            .cloned()
            .ok_or(FusionError::ApplicationNotFound)
    })?;
    let executable = Path::new(&application.executable_path);
    if executable.is_file() {
        std::process::Command::new("open")
            .arg("-R")
            .arg(executable)
            .spawn()
            .map_err(|_| FusionError::LaunchFailed)?;
        Ok(())
    } else {
        Err(FusionError::InvalidExecutable)
    }
}

#[tauri::command]
pub fn run_executable_in_bottle(
    app: AppHandle,
    bottle_id: String,
    executable_rel_path: String,
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
    let d = dirs(&app);
    let prefix = paths::safe_join(&d.bottles, &bottle.id)?;
    let executable = paths::safe_file(&prefix, &executable_rel_path)?;
    if !is_windows_executable(&executable) {
        return Err(FusionError::InvalidExecutable);
    }
    if !crate::wine::prefix::prefix_prepared(&prefix) {
        crate::wine::prefix::init_prefix(&binary, &prefix)?;
    }
    deploy_graphics_libraries(&app, &prefix);
    crate::wine::prefix::ensure_graphics_registry(&prefix, &bottle.graphics).ok();

    let safe = settings_bool(&app, "safe_mode");
    let (override_env, dll_overrides) = build_wine_execution_context(&binary, &bottle, safe);

    let mut cmd = std::process::Command::new(&binary);
    cmd.env("WINEPREFIX", &prefix);
    cmd.env("WINEDLLOVERRIDES", &dll_overrides);
    for (k, v) in override_env {
        cmd.env(k, v);
    }
    cmd.arg(&executable);
    for arg in args {
        cmd.arg(arg);
    }
    cmd.spawn().map_err(|_| FusionError::LaunchFailed)?;
    Ok(())
}

fn is_windows_executable(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|extension| extension.to_str())
            .map(|extension| extension.to_ascii_lowercase())
            .as_deref(),
        Some("exe" | "com" | "bat" | "cmd" | "msi")
    )
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
    if let Some(version) = &windows_version {
        super::validation::choice(
            version,
            &[
                "win11", "win10", "win81", "win8", "win7", "vista", "winxp", "win2000", "win98",
            ],
        )?;
    }
    if let Some(backend) = &graphics {
        super::validation::choice(
            backend,
            &["automatic", "auto", "d3dmetal", "dxvk", "dxmt", "wined3d"],
        )?;
    }
    if let Some(values) = &environment {
        super::validation::environment(values)?;
    }
    if dll_overrides.as_ref().is_some_and(|values| {
        values
            .iter()
            .any(|v| v.is_empty() || v.chars().any(char::is_control))
    }) {
        return Err(FusionError::InvalidInput);
    }
    let st = app.state::<FusionState>();
    st.update(|s| {
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
    })
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

    crate::manager::spawn_job(handle.clone(), job_id.clone(), move || {
        let jobs = handle.state::<Jobs>();
        match crate::wine::prefix::install_verbs(
            &binary,
            &prefix,
            std::slice::from_ref(&verb_clone),
        ) {
            Ok(()) => {
                let st = handle.state::<FusionState>();
                let saved = st.update(|s| {
                    if let Some(b) = s.bottles.iter_mut().find(|b| b.id == bottle_id_clone) {
                        if !b.dependencies.contains(&verb_clone) {
                            b.dependencies.push(verb_clone.clone());
                        }
                    }
                    Ok(())
                });
                if let Err(error) = saved {
                    jobs.fail(
                        &job_id,
                        format!("Installed {verb_clone}, but saving its metadata failed: {error}"),
                    );
                    return;
                }
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

    crate::manager::spawn_job(handle.clone(), job_id.clone(), move || {
        let jobs = handle.state::<Jobs>();
        match crate::wine::prefix::install_verbs(&binary, &prefix, &verbs) {
            Ok(()) => {
                let st = handle.state::<FusionState>();
                let saved = st.update(|s| {
                    if let Some(b) = s.bottles.iter_mut().find(|b| b.id == bottle_id_clone) {
                        for v in &verbs {
                            if !b.dependencies.contains(v) {
                                b.dependencies.push(v.clone());
                            }
                        }
                    }
                    Ok(())
                });
                if let Err(error) = saved {
                    jobs.fail(
                        &job_id,
                        format!(
                            "Installed dependencies, but saving their metadata failed: {error}"
                        ),
                    );
                    return;
                }
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
