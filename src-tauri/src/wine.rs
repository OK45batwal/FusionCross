// ========================================================
// WINE EXECUTION ENGINE
// ========================================================

use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

use crate::security::{validate_executable_path, validate_host_installer_path};
use crate::types::*;

/// Spawn a thread with panic-catching that logs errors via eprintln.
/// All fire-and-forget threads should use this instead of raw `std::thread::spawn`.
pub fn spawn_fallible<F>(name: &str, f: F) -> std::thread::JoinHandle<()>
where
  F: FnOnce() + Send + 'static,
{
  let name = name.to_string();
  std::thread::spawn(move || {
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(f));
    if let Err(panic) = result {
      let msg = panic
        .downcast_ref::<&str>()
        .map(|s| s.to_string())
        .or_else(|| panic.downcast_ref::<String>().cloned())
        .unwrap_or_else(|| "unknown panic".to_string());
      eprintln!("[FusionCross] Thread '{}' panicked: {}", name, msg);
    }
  })
}

// ========================================================
// WINE BINARY RESOLUTION
// ========================================================

pub fn resolve_wine_binary(settings: &AppSettings) -> Option<String> {
  let wine_candidates = [
    settings.wine_binary_path.as_str(),
    "/usr/local/bin/wine64",
    "/opt/homebrew/bin/wine64",
    "/Applications/CrossOver.app/Contents/SharedSupport/CrossOver/bin/wine64",
  ];

  if let Some(path) = wine_candidates.iter().find(|p| Path::new(p).exists()) {
    return Some(path.to_string());
  }

  // $PATH fallback via `which` for Homebrew-installed wine and other package managers
  for bin in &["wine64", "wine"] {
    if let Ok(output) = std::process::Command::new("which").arg(bin).output() {
      if output.status.success() {
        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !path.is_empty() {
          return Some(path);
        }
      }
    }
  }

  None
}

pub fn resolve_winetricks_binary() -> Option<String> {
  let candidates = [
    "/opt/homebrew/bin/winetricks",
    "/usr/local/bin/winetricks",
    "winetricks",
  ];

  if let Some(path) = candidates.iter().find(|p| Path::new(p).exists()) {
    return Some(path.to_string());
  }

  // $PATH fallback via `which`
  if let Ok(output) = std::process::Command::new("which").arg("winetricks").output() {
    if output.status.success() {
      let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
      if !path.is_empty() {
        return Some(path);
      }
    }
  }

  None
}

// ========================================================
// PATH CONVERSION
// ========================================================

pub fn dll_override_abbrev(override_type: &str) -> &str {
  match override_type {
    "native,builtin" | "builtin,native" => "n,b",
    "native" => "n",
    "builtin" => "b",
    "disabled" => "",
    other => other,
  }
}

pub fn unix_path_to_windows(prefix_path: &str, unix_path: &Path) -> String {
  let drive_c = Path::new(prefix_path).join("drive_c");
  if let Ok(relative) = unix_path.strip_prefix(&drive_c) {
    format!(
      "C:\\{}",
      relative.to_string_lossy().replace('/', "\\")
    )
  } else {
    unix_path.to_string_lossy().to_string()
  }
}

pub fn windows_path_to_unix(prefix_path: &str, windows_path: &str) -> Result<std::path::PathBuf, String> {
  let trimmed = windows_path.trim().trim_matches('"');
  if trimmed.starts_with('/') {
    return Ok(std::path::PathBuf::from(trimmed));
  }

  let normalized = trimmed.replace('/', "\\");
  let rest = normalized
    .strip_prefix("C:\\")
    .or_else(|| normalized.strip_prefix("c:\\"))
    .ok_or_else(|| {
      format!(
        "Unsupported Windows path '{}'. Use C:\\\\ paths or a full macOS file path.",
        windows_path
      )
    })?;

  Ok(Path::new(prefix_path)
    .join("drive_c")
    .join(rest.replace('\\', "/")))
}

// ========================================================
// LAUNCH TARGET RESOLUTION
// ========================================================

pub fn resolve_launch_target(prefix_path: &str, input_path: &str) -> Result<ResolvedLaunch, String> {
  validate_executable_path(input_path)?;

  let unix_path = if input_path.contains('\\') && !input_path.starts_with('/') {
    windows_path_to_unix(prefix_path, input_path)?
  } else if input_path.starts_with('/') {
    validate_host_installer_path(input_path)?
  } else {
    let in_prefix = Path::new(prefix_path).join(input_path);
    if in_prefix.exists() {
      in_prefix
    } else {
      validate_host_installer_path(input_path)?
    }
  };

  if !unix_path.exists() {
    return Err(format!(
      "Executable not found: {}. Install the program into this bottle first, or pick the installer file.",
      unix_path.display()
    ));
  }

  let ext = unix_path
    .extension()
    .and_then(|e| e.to_str())
    .map(|s| s.to_lowercase());

  let kind = match ext.as_deref() {
    Some("msi") => WineLaunchKind::Msi {
      unix_path: unix_path.clone(),
    },
    _ => WineLaunchKind::Exe {
      unix_path: unix_path.clone(),
    },
  };

  let windows_path = if input_path.contains('\\') {
    input_path.to_string()
  } else {
    unix_path_to_windows(prefix_path, &unix_path)
  };

  Ok(ResolvedLaunch {
    kind,
    windows_path,
  })
}

// ========================================================
// WINE PROCESS MANAGEMENT
// ========================================================

pub fn emit_log(app_handle: &AppHandle, message: impl AsRef<str>) {
  let _ = app_handle.emit("wine-log-stream", message.as_ref().to_string());
}

pub fn build_wine_dll_overrides(bottle: Option<&Bottle>) -> String {
  let Some(bottle) = bottle else {
    return "d3d11,dxgi=n,b".to_string();
  };

  if bottle.dll_overrides.is_empty() {
    return "d3d11,dxgi=n,b".to_string();
  }

  bottle
    .dll_overrides
    .iter()
    .map(|o| format!("{}={}", o.library, dll_override_abbrev(&o.override_type)))
    .collect::<Vec<_>>()
    .join(";")
}

pub fn build_wine_command(
  wine_bin: &str,
  prefix_path: &str,
  launch: &ResolvedLaunch,
  arguments: &str,
  dll_overrides: &str,
  env_vars: &HashMap<String, String>,
  verbose: bool,
) -> Command {
  let mut command = Command::new(wine_bin);
  command
    .env("WINEPREFIX", prefix_path)
    .env("WINEDLLOVERRIDES", dll_overrides)
    .stdout(Stdio::piped())
    .stderr(Stdio::piped());

  if verbose {
    command.env("WINEDEBUG", "+timestamp,+pid,+tid,+seh");
  }

  for (key, value) in env_vars {
    command.env(key, value);
  }

  match &launch.kind {
    WineLaunchKind::Msi { unix_path } => {
      command.arg("msiexec").arg("/i").arg(unix_path);
      let extra: Vec<&str> = arguments
        .split_whitespace()
        .filter(|s| !s.is_empty())
        .collect();
      if !extra.is_empty() {
        command.args(extra);
      }
    }
    WineLaunchKind::Exe { unix_path } => {
      command.arg(unix_path);
      command.args(
        arguments
          .split_whitespace()
          .filter(|s| !s.is_empty()),
      );
    }
  }

  command
}

pub fn stream_process_output(
  process: &mut std::process::Child,
  app_handle: &AppHandle,
) {
  if let Some(stderr) = process.stderr.take() {
    let reader = BufReader::new(stderr);
    for line in reader.lines().flatten() {
      emit_log(app_handle, format!("[Wine] {}", line));
    }
  }
  if let Some(stdout) = process.stdout.take() {
    let reader = BufReader::new(stdout);
    for line in reader.lines().flatten() {
      emit_log(app_handle, format!("[Wine] {}", line));
    }
  }
}

pub fn run_wine_launch(
  prefix_path: &str,
  launch: ResolvedLaunch,
  arguments: String,
  settings: AppSettings,
  bottle: Option<Bottle>,
  app_handle: &AppHandle,
  active_child_pid: Arc<Mutex<Option<u32>>>,
  wait_for_exit: bool,
  clear_active_on_exit: bool,
) -> Result<InstallResult, String> {
  let wine_bin = resolve_wine_binary(&settings)
    .ok_or_else(|| {
      "Wine is not installed. Install with: brew install --cask wine-stable".to_string()
    })?;

  let dll_overrides = build_wine_dll_overrides(bottle.as_ref());
  let verbose = settings.verbose_logs;

  emit_log(
    app_handle,
    format!("[FusionCross] Using Wine at {}", wine_bin),
  );
  emit_log(
    app_handle,
    format!(
      "[FusionCross] Target: {} {}",
      launch.windows_path,
      arguments
    ),
  );

  let env_vars = bottle
    .as_ref()
    .map(|b| b.env_vars.clone())
    .unwrap_or_default();

  let mut command = build_wine_command(
    &wine_bin,
    prefix_path,
    &launch,
    &arguments,
    &dll_overrides,
    &env_vars,
    verbose,
  );

  let mut process = command
    .spawn()
    .map_err(|e| format!("Failed to start Wine: {}", e))?;

  if let Ok(mut pid_guard) = active_child_pid.lock() {
    *pid_guard = Some(process.id());
  }

  let pid = process.id();
  emit_log(
    app_handle,
    format!("[FusionCross] Process started (PID {})", pid),
  );

  if !wait_for_exit {
    let app_handle_bg = app_handle.clone();
    let active_child_pid_bg = active_child_pid.clone();
    spawn_fallible("wine-process-watcher", move || {
      stream_process_output(&mut process, &app_handle_bg);
      let _ = process.wait();
      if let Ok(mut pid_guard) = active_child_pid_bg.lock() {
        *pid_guard = None;
      }
      emit_log(&app_handle_bg, "[FusionCross] Process exited.".to_string());
      if clear_active_on_exit {
        let _ = app_handle_bg.emit("app-process-exited", ());
      }
    });

    return Ok(InstallResult {
      success: true,
      exit_code: 0,
      windows_path: launch.windows_path,
      message: "Application launch started.".to_string(),
    });
  }

  stream_process_output(&mut process, app_handle);
  let status = process
    .wait()
    .map_err(|e| format!("Failed while waiting for Wine process: {}", e))?;

  if let Ok(mut pid_guard) = active_child_pid.lock() {
    *pid_guard = None;
  }

  let exit_code = status.code().unwrap_or(-1);
  let success = status.success();
  emit_log(
    app_handle,
    format!(
      "[FusionCross] Process finished with exit code {}",
      exit_code
    ),
  );

  if clear_active_on_exit {
    let _ = app_handle.emit("app-process-exited", ());
  }

  Ok(InstallResult {
    success,
    exit_code,
    windows_path: launch.windows_path,
    message: if success {
      "Installer completed successfully.".to_string()
    } else {
      format!("Installer exited with code {}.", exit_code)
    },
  })
}

pub fn spawn_wine_process(
  prefix_path: String,
  exe_path: String,
  arguments: String,
  settings: AppSettings,
  bottle: Option<Bottle>,
  app_handle: AppHandle,
  active_child_pid: Arc<Mutex<Option<u32>>>,
  active_process_id: Arc<Mutex<Option<String>>>,
  clear_active_on_exit: bool,
) {
  let launch_result = resolve_launch_target(&prefix_path, &exe_path);
  let app_handle_clone = app_handle.clone();
  let active_child_pid_clone = active_child_pid.clone();
  let active_process_id_clone = active_process_id.clone();

  spawn_fallible("spawn-wine-process", move || {
    let launch = match launch_result {
      Ok(launch) => launch,
      Err(err) => {
        emit_log(&app_handle_clone, format!("[FusionCross:Error] {}", err));
        if let Ok(mut pid) = active_process_id_clone.lock() {
          *pid = None;
        }
        if clear_active_on_exit {
          let _ = app_handle_clone.emit("app-process-exited", ());
        }
        return;
      }
    };

    let result = run_wine_launch(
      &prefix_path,
      launch,
      arguments,
      settings,
      bottle,
      &app_handle_clone,
      active_child_pid_clone,
      true,
      clear_active_on_exit,
    );

    if let Err(err) = &result {
      emit_log(&app_handle_clone, format!("[FusionCross:Error] {}", err));
    }

    if let Ok(mut pid) = active_process_id_clone.lock() {
      *pid = None;
    }
    if clear_active_on_exit {
      let _ = app_handle_clone.emit("app-process-exited", ());
    }
  });
}

/// Initialize a Wine prefix by creating the folder layout and running wineboot.
pub fn initialize_bottle_prefix(
  prefix_path: &str,
  prefix_type: &str,
  settings: &AppSettings,
  app_handle: Option<&AppHandle>,
) -> Result<SandboxInfo, String> {
  use crate::sandbox::initialize_prefix_sandbox_impl;

  let info = initialize_prefix_sandbox_impl(prefix_path, prefix_type)?;

  let Some(wine_bin) = resolve_wine_binary(settings) else {
    if let Some(handle) = app_handle {
      emit_log(
        handle,
        "[FusionCross] Wine is not installed. Created folder layout only — install Wine, then reset the bottle.",
      );
    }
    return Ok(info);
  };

  if let Some(handle) = app_handle {
    emit_log(handle, "[FusionCross] Initializing Wine prefix (wineboot -i)...");
  }

  let output = Command::new(&wine_bin)
    .env("WINEPREFIX", prefix_path)
    .arg("wineboot")
    .arg("-i")
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .output();

  match output {
    Ok(out) if out.status.success() => {
      if let Some(handle) = app_handle {
        emit_log(handle, "[FusionCross] Wine prefix is ready.");
      }
    }
    Ok(out) => {
      let err = String::from_utf8_lossy(&out.stderr);
      if let Some(handle) = app_handle {
        emit_log(
          handle,
          format!(
            "[FusionCross:Warn] wineboot returned {}: {}",
            out.status,
            err.trim()
          ),
        );
      }
    }
    Err(e) => {
      if let Some(handle) = app_handle {
        emit_log(handle, format!("[FusionCross:Warn] wineboot failed: {}", e));
      }
    }
  }

  Ok(info)
}
