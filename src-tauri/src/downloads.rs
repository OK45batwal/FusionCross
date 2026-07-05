// ========================================================
// RUNTIME DOWNLOAD & ENGINE MANAGEMENT
// ========================================================

use std::fs;
use std::process::{Command, Stdio};
use tauri::{AppHandle, Emitter};

use crate::security::{validate_download_url, validate_id, validate_tar_archive_for_safe_extract};
use crate::state::get_fusioncross_base_dir;
use crate::wine::spawn_fallible;
use crate::security::validate_sandbox_path;
use crate::types::DownloadProgress;

/// Download and safely extract a Wine/Proton engine archive from a trusted source.
pub fn download_wine_engine_impl(
  engine_url: String,
  target_id: String,
  app_handle: AppHandle,
) -> Result<String, String> {
  validate_id(&target_id)?;
  validate_download_url(&engine_url)?;

  let base = get_fusioncross_base_dir();
  let runtimes_dir = base.join("runtimes");
  let target_dir = runtimes_dir.join(&target_id);
  validate_sandbox_path(&target_dir)?;

  fs::create_dir_all(&target_dir)
    .map_err(|e| format!("Failed to create runtime directory: {}", e))?;

  let target_id_clone = target_id.clone();
  let target_dir_clone = target_dir.clone();

  spawn_fallible("download-engine", move || {
    let _ = app_handle.emit("download-progress", DownloadProgress {
      id: target_id_clone.clone(),
      progress: 0,
      status: "downloading".to_string(),
      message: format!("Starting download from {}...", engine_url),
    });

    let archive_path = target_dir_clone.join("engine.tar.gz");
    let curl_result = Command::new("curl")
      .args(["-L", "-o"])
      .arg(archive_path.to_string_lossy().as_ref())
      .arg(&engine_url)
      .arg("--progress-bar")
      .stdout(Stdio::piped())
      .stderr(Stdio::piped())
      .output();

    match curl_result {
      Ok(output) => {
        if !output.status.success() {
          let err = String::from_utf8_lossy(&output.stderr);
          let _ = app_handle.emit("download-progress", DownloadProgress {
            id: target_id_clone.clone(),
            progress: 0,
            status: "error".to_string(),
            message: format!("Download failed: {}", err),
          });
          return;
        }

        let _ = app_handle.emit("download-progress", DownloadProgress {
          id: target_id_clone.clone(),
          progress: 60,
          status: "extracting".to_string(),
          message: "Download complete. Extracting safely...".to_string(),
        });

        if let Err(err) = validate_tar_archive_for_safe_extract(&archive_path) {
          let _ = app_handle.emit("download-progress", DownloadProgress {
            id: target_id_clone.clone(),
            progress: 60,
            status: "error".to_string(),
            message: format!("Unsafe archive rejected: {}", err),
          });
          let _ = fs::remove_file(&archive_path);
          return;
        }

        let tar_result = Command::new("tar")
          .args(["-xzf"])
          .arg(archive_path.to_string_lossy().as_ref())
          .arg("-C")
          .arg(target_dir_clone.to_string_lossy().as_ref())
          .output();

        match tar_result {
          Ok(tar_out) => {
            if tar_out.status.success() {
              let _ = fs::remove_file(&archive_path);

              let _ = app_handle.emit("download-progress", DownloadProgress {
                id: target_id_clone.clone(),
                progress: 100,
                status: "complete".to_string(),
                message: "Engine installed successfully!".to_string(),
              });
            } else {
              let err = String::from_utf8_lossy(&tar_out.stderr);
              let _ = app_handle.emit("download-progress", DownloadProgress {
                id: target_id_clone.clone(),
                progress: 60,
                status: "error".to_string(),
                message: format!("Extraction failed: {}", err),
              });
            }
          }
          Err(e) => {
            let _ = app_handle.emit("download-progress", DownloadProgress {
              id: target_id_clone.clone(),
              progress: 60,
              status: "error".to_string(),
              message: format!("Failed to run tar: {}", e),
            });
          }
        }
      }
      Err(e) => {
        let _ = app_handle.emit("download-progress", DownloadProgress {
          id: target_id_clone.clone(),
          progress: 0,
          status: "error".to_string(),
          message: format!("Failed to start curl: {}", e),
        });
      }
    }
  });

  Ok(format!("Download started for engine '{}'", target_id))
}

/// Download and safely extract a runtime engine from a trusted URL.
pub fn trigger_runtime_download_impl(
  id: String,
  download_url: String,
  app_handle: AppHandle,
) {
  spawn_fallible("download-runtime", move || {
    let _ = app_handle.emit("download-progress", DownloadProgress {
      id: id.clone(),
      progress: 0,
      status: "downloading".to_string(),
      message: format!("Starting download from {}...", download_url),
    });

    let base = get_fusioncross_base_dir();
    let runtimes_dir = base.join("runtimes");
    let target_dir = runtimes_dir.join(&id);
    if let Err(e) = crate::security::validate_sandbox_path(&target_dir) {
      let _ = app_handle.emit("download-progress", DownloadProgress {
        id: id.clone(),
        progress: 0,
        status: "error".to_string(),
        message: format!("Security error: {}", e),
      });
      return;
    }
    let _ = fs::create_dir_all(&target_dir);

    let archive_path = target_dir.join("runtime.tar.gz");
    let curl_result = Command::new("curl")
      .args(["-L", "-o"])
      .arg(archive_path.to_string_lossy().as_ref())
      .arg(&download_url)
      .arg("--progress-bar")
      .stdout(Stdio::piped())
      .stderr(Stdio::piped())
      .output();

    match curl_result {
      Ok(output) => {
        if !output.status.success() {
          let err = String::from_utf8_lossy(&output.stderr);
          let _ = app_handle.emit("download-progress", DownloadProgress {
            id: id.clone(),
            progress: 0,
            status: "error".to_string(),
            message: format!("Download failed: {}", err),
          });
          return;
        }

        let _ = app_handle.emit("download-progress", DownloadProgress {
          id: id.clone(),
          progress: 60,
          status: "extracting".to_string(),
          message: "Download complete. Extracting safely...".to_string(),
        });

        if let Err(err) = validate_tar_archive_for_safe_extract(&archive_path) {
          let _ = app_handle.emit("download-progress", DownloadProgress {
            id: id.clone(),
            progress: 60,
            status: "error".to_string(),
            message: format!("Unsafe archive rejected: {}", err),
          });
          let _ = fs::remove_file(&archive_path);
          return;
        }

        let tar_result = Command::new("tar")
          .args(["-xzf"])
          .arg(archive_path.to_string_lossy().as_ref())
          .arg("-C")
          .arg(target_dir.to_string_lossy().as_ref())
          .output();

        match tar_result {
          Ok(tar_out) => {
            if tar_out.status.success() {
              let _ = fs::remove_file(&archive_path);

              let _ = app_handle.emit("download-progress", DownloadProgress {
                id: id.clone(),
                progress: 100,
                status: "complete".to_string(),
                message: "Runtime installed successfully!".to_string(),
              });
              let _ = app_handle.emit("runtime-downloaded", id.clone());
            } else {
              let err = String::from_utf8_lossy(&tar_out.stderr);
              let _ = app_handle.emit("download-progress", DownloadProgress {
                id: id.clone(),
                progress: 60,
                status: "error".to_string(),
                message: format!("Extraction failed: {}", err),
              });
            }
          }
          Err(e) => {
            let _ = app_handle.emit("download-progress", DownloadProgress {
              id: id.clone(),
              progress: 60,
              status: "error".to_string(),
              message: format!("Failed to run tar: {}", e),
            });
          }
        }
      }
      Err(e) => {
        let _ = app_handle.emit("download-progress", DownloadProgress {
          id: id.clone(),
          progress: 0,
          status: "error".to_string(),
          message: format!("Failed to start curl: {}", e),
        });
      }
    }
  });
}


