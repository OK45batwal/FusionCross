use std::path::Path;
use tauri::{AppHandle, Manager};

use crate::core::errors::FusionError;
use crate::core::ids::new_id;
use crate::core::paths;
use crate::core::state::Runtime;
use crate::manager::{dirs, FusionState, Jobs};
use crate::runtime::{self, catalog};
use crate::wine::engine::{RuntimeEngine, WineEngine};

use super::wine_binary_for;

#[tauri::command]
pub fn probe_runtime(
    app: AppHandle,
    engine: String,
) -> Result<runtime::RuntimeStatus, FusionError> {
    let version = if let Ok(bin) = wine_binary_for(&app, &engine) {
        let out = std::process::Command::new(&bin).arg("--version").output();
        out.ok()
            .and_then(|o| {
                crate::wine::engine::parse_wine_version(&String::from_utf8_lossy(&o.stdout))
            })
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
