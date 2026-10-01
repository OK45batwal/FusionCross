#![allow(dead_code)]

use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use crate::compatibility::{self, GameCatalogItem};
use crate::core::errors::FusionError;
use crate::manager::{FusionState, Jobs};

use super::bottles::{create_bottle, install_bottle_verb};
use super::installers::install_job;

#[tauri::command]
pub fn get_game_catalog() -> Vec<GameCatalogItem> {
    compatibility::get_catalog()
}

#[tauri::command]
pub fn install_catalog_game(
    app: AppHandle,
    catalog_id: String,
    bottle_id: Option<String>,
) -> Result<String, FusionError> {
    let catalog = compatibility::get_catalog();
    let item = catalog
        .iter()
        .find(|i| i.id == catalog_id)
        .cloned()
        .ok_or(FusionError::Unsupported)?;

    let installer_url = item.installer_url.ok_or(FusionError::Unsupported)?;

    let jobs = app.state::<Jobs>();
    let job = jobs.begin(format!("Preparing installer for {}", item.title));
    let job_id = job.clone();
    let handle = app.clone();

    std::thread::spawn(move || {
        let jobs = handle.state::<Jobs>();
        let res = (|| -> Result<String, FusionError> {
            // 1. Determine or create target bottle
            let target_bottle_id = match bottle_id {
                Some(bid) => bid,
                None => {
                    let st = handle.state::<FusionState>();
                    let existing_bottle = st.with_state(|s| {
                        Ok(s.bottles
                            .iter()
                            .find(|b| {
                                b.name.to_lowercase().contains(&item.id)
                                    || b.name == "Gaming Bottle"
                                    || b.prefix_type == "gaming"
                            })
                            .map(|b| b.id.clone()))
                    });
                    match existing_bottle {
                        Ok(Some(id)) => id,
                        _ => {
                            let b = create_bottle(
                                handle.clone(),
                                format!("{} Bottle", item.title),
                                "gaming".into(),
                            )?;
                            b.id
                        }
                    }
                }
            };

            // 2. Download installer into user Application Support downloads cache
            let home = std::env::var("HOME")
                .map(PathBuf::from)
                .map_err(|_| FusionError::PermissionDenied)?;
            let dl_dir = home.join("Library/Application Support/FusionCross/downloads");
            std::fs::create_dir_all(&dl_dir).map_err(|_| FusionError::PermissionDenied)?;

            let filename = format!("{}_installer.exe", item.id);
            let local_installer = dl_dir.join(&filename);

            if !local_installer.exists()
                || std::fs::metadata(&local_installer)
                    .map(|m| m.len() < 50_000)
                    .unwrap_or(true)
            {
                let curl_status = std::process::Command::new("curl")
                    .args(["-fL", "--max-time", "600", "-o"])
                    .arg(&local_installer)
                    .arg(installer_url)
                    .status()
                    .map_err(|_| FusionError::InstallationFailed)?;
                if !curl_status.success() {
                    return Err(FusionError::InstallationFailed);
                }
            }

            // 3. Pre-install dependencies
            for dep in &item.dependencies {
                let _ =
                    install_bottle_verb(handle.clone(), target_bottle_id.clone(), dep.to_string());
            }

            // 4. Run installer inside target bottle
            install_job(
                &handle,
                &target_bottle_id,
                &local_installer.to_string_lossy(),
                &filename,
            )
        })();

        match res {
            Ok(msg) => jobs.finish(&job_id, msg),
            Err(e) => jobs.fail(&job_id, format!("Failed to install {} — {e}", item.title)),
        }
    });

    Ok(job)
}
