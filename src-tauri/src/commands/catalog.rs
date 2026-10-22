#![allow(dead_code)]

use tauri::{AppHandle, Manager};

use crate::compatibility::{self, GameCatalogItem};
use crate::core::errors::FusionError;
use crate::manager::{FusionState, Jobs};

use super::bottles::create_bottle;
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
    let (job, control) = jobs.begin_cancellable(format!("Preparing installer for {}", item.title));
    let job_id = job.clone();
    let handle = app.clone();

    crate::manager::spawn_job(handle.clone(), job_id.clone(), move || {
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
                                b.name.to_lowercase().contains(item.id)
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
                                Some(false),
                            )?;
                            // Initialize here so the install owns the prefix;
                            // one `wineboot` must never race another.
                            super::bottles::initialize_bottle_prefix(&handle, &b.id)?;
                            b.id
                        }
                    }
                }
            };

            // 2. Download installer into user Application Support downloads cache
            control.check()?;
            let dl_dir = crate::manager::dirs(&handle).downloads;
            std::fs::create_dir_all(&dl_dir).map_err(|_| FusionError::PermissionDenied)?;

            let filename = download_name(item.id, installer_url);
            let local_installer = dl_dir.join(format!("{job_id}-{filename}"));

            let curl_status = control.run(
                std::process::Command::new("curl")
                    .args([
                        "-fL",
                        "--proto",
                        "=https",
                        "--proto-redir",
                        "=https",
                        "--max-time",
                        "600",
                        "-o",
                    ])
                    .arg(&local_installer)
                    .arg(installer_url),
            );
            let curl_status = match curl_status {
                Ok(status) => status,
                Err(error) => {
                    let _ = std::fs::remove_file(&local_installer);
                    return Err(error);
                }
            };
            if !curl_status.success() {
                let _ = std::fs::remove_file(&local_installer);
                return Err(FusionError::InstallationFailed);
            }

            // Initialize the prefix before installing recipe dependencies and the app.
            let dependencies: Vec<_> = item.dependencies.iter().map(|v| v.to_string()).collect();
            let result = install_job(
                &handle,
                &target_bottle_id,
                &local_installer.to_string_lossy(),
                &filename,
                &dependencies,
                &control,
            );
            let _ = std::fs::remove_file(&local_installer);
            result
        })();

        match res {
            Ok(msg) => jobs.finish(&job_id, msg),
            Err(e) => jobs.fail(&job_id, format!("Failed to install {} — {e}", item.title)),
        }
    });

    Ok(job)
}

/// Catalogue installers keep their real name so Wine sees the right extension
/// (`.msi` installers need `msiexec`).
fn download_name(catalog_id: &str, url: &str) -> String {
    let last = url
        .split(['?', '#'])
        .next()
        .unwrap_or(url)
        .rsplit('/')
        .next()
        .unwrap_or("");
    let lower = last.to_ascii_lowercase();
    if (lower.ends_with(".exe") || lower.ends_with(".msi"))
        && !last.contains(['/', '\\'])
        && !last.is_empty()
    {
        last.to_string()
    } else {
        format!("{catalog_id}_installer.exe")
    }
}

#[cfg(test)]
mod tests {
    use super::download_name;

    #[test]
    fn keeps_installer_extension_from_url() {
        assert_eq!(
            download_name(
                "fortnite",
                "https://cdn.example.com/FortniteSetup.msi?token=1"
            ),
            "FortniteSetup.msi"
        );
        assert_eq!(
            download_name("epic", "https://cdn.example.com/EpicInstaller.exe"),
            "EpicInstaller.exe"
        );
        assert_eq!(
            download_name("weird", "https://cdn.example.com/download"),
            "weird_installer.exe"
        );
    }
}
