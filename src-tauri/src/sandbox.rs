// ========================================================
// WINE PREFIX SANDBOX INITIALIZATION & SCANNING
// ========================================================

use std::fs;
use std::path::Path;

use crate::security::validate_sandbox_path;
use crate::types::*;
use crate::wine::unix_path_to_windows;

/// Create the full folder structure, registry stubs, and DLL overrides for a new Wine prefix.
pub fn initialize_prefix_sandbox_impl(prefix_path: &str, prefix_type: &str) -> Result<SandboxInfo, String> {
  let base_path = Path::new(prefix_path);
  validate_sandbox_path(base_path)?;

  let directories = vec![
    base_path.join("drive_c"),
    base_path.join("drive_c").join("windows"),
    base_path.join("drive_c").join("windows").join("system32"),
    base_path.join("drive_c").join("windows").join("syswow64"),
    base_path.join("drive_c").join("windows").join("Fonts"),
    base_path.join("drive_c").join("windows").join("Installer"),
    base_path.join("drive_c").join("windows").join("temp"),
    base_path.join("drive_c").join("Program Files"),
    base_path.join("drive_c").join("Program Files (x86)"),
    base_path.join("drive_c").join("ProgramData"),
    base_path.join("drive_c").join("users"),
    base_path.join("drive_c").join("users").join("steamuser"),
    base_path.join("drive_c").join("users").join("steamuser").join("Desktop"),
    base_path.join("drive_c").join("users").join("steamuser").join("Documents"),
    base_path.join("drive_c").join("users").join("steamuser").join("Downloads"),
    base_path.join("drive_c").join("users").join("steamuser").join("AppData"),
    base_path.join("drive_c").join("users").join("steamuser").join("AppData").join("Local"),
    base_path.join("drive_c").join("users").join("steamuser").join("AppData").join("Roaming"),
    base_path.join("dosdevices"),
  ];

  let mut total_files: u32 = 0;
  for dir in &directories {
    fs::create_dir_all(dir).map_err(|e| format!("Failed to create directory {}: {}", dir.display(), e))?;
    total_files += 1;
  }

  let dos_c = base_path.join("dosdevices").join("c:");
  if !dos_c.exists() {
    #[cfg(unix)]
    {
      let _ = std::os::unix::fs::symlink(base_path.join("drive_c"), &dos_c);
      total_files += 1;
    }
  }

  let system_reg_content = format!(
    r#"WINE REGISTRY Version 2
;; FusionCross Auto-Generated System Registry
;; Prefix Type: {prefix_type}
;; Generated: 2026-05-22

[System\\CurrentControlSet\\Control\\Windows]
"CSDVersion"=dword:00000200

[Software\\Microsoft\\Windows\\CurrentVersion]
"ProgramFilesDir"="C:\\Program Files"
"CommonFilesDir"="C:\\Program Files\\Common Files"

[Software\\Microsoft\\Windows NT\\CurrentVersion]
"CurrentBuild"="19045"
"CurrentBuildNumber"="19045"
"CurrentVersion"="6.3"
"ProductName"="Windows 10 Pro"

[Software\\Wine\\DllOverrides]
"d3d11"="native,builtin"
"d3d9"="native,builtin"
"dxgi"="native,builtin"
"d3d10core"="native,builtin"

[Software\\Wine\\Direct3D]
"MaxShaderModelVS"=dword:00000005
"MaxShaderModelPS"=dword:00000005
"MaxShaderModelGS"=dword:00000005
"csmt"=dword:00000003
"#
  );

  let user_reg_content = format!(
    r#"WINE REGISTRY Version 2
;; FusionCross Auto-Generated User Registry
;; Generated: 2026-05-22

[Software\\Wine\\Mac Driver]
"RetinaMode"="Y"

[Software\\Wine\\DllOverrides]
"winemenubuilder.exe"=""

[Control Panel\\Desktop]
"FontSmoothing"="2"
"FontSmoothingType"=dword:00000002
"FontSmoothingGamma"=dword:00000578
"#
  );

  let system_reg_path = base_path.join("system.reg");
  let user_reg_path = base_path.join("user.reg");
  let userdef_reg_path = base_path.join("userdef.reg");

  fs::write(&system_reg_path, system_reg_content).map_err(|e| format!("Failed system.reg: {}", e))?;
  total_files += 1;

  fs::write(&user_reg_path, user_reg_content).map_err(|e| format!("Failed user.reg: {}", e))?;
  total_files += 1;

  fs::write(&userdef_reg_path, "WINE REGISTRY Version 2\n;; Default user registry\n").map_err(|e| format!("Failed userdef.reg: {}", e))?;
  total_files += 1;

  let mut dll_stubs: Vec<String> = Vec::new();
  let dlls_to_inject = ["d3d11.dll", "d3d9.dll", "dxgi.dll", "d3d10core.dll"];
  for dll_name in &dlls_to_inject {
    let dll_path = base_path.join("drive_c").join("windows").join("system32").join(dll_name);
    let stub_content = format!(
      "FusionCross DLL Override Stub\nLibrary: {}\nType: native,builtin\nNote: DXVK active\n",
      dll_name
    );
    fs::write(&dll_path, stub_content).map_err(|e| format!("Failed stub copy {}: {}", dll_name, e))?;
    dll_stubs.push(dll_name.to_string());
    total_files += 1;
  }

  let timestamp_path = base_path.join(".update-timestamp");
  fs::write(&timestamp_path, "1716393600").map_err(|e| format!("Failed to write timestamp: {}", e))?;
  total_files += 1;

  let info = SandboxInfo {
    bottle_id: String::new(),
    prefix_path: prefix_path.to_string(),
    drive_c_path: base_path.join("drive_c").to_string_lossy().to_string(),
    system32_path: base_path.join("drive_c").join("windows").join("system32").to_string_lossy().to_string(),
    program_files_path: base_path.join("drive_c").join("Program Files").to_string_lossy().to_string(),
    registry_files: vec![
      system_reg_path.to_string_lossy().to_string(),
      user_reg_path.to_string_lossy().to_string(),
      userdef_reg_path.to_string_lossy().to_string(),
    ],
    dll_overrides_injected: dll_stubs,
    total_files_created: total_files,
  };

  Ok(info)
}

/// Recursively scan a directory tree for .exe files, skipping uninstallers, helpers, etc.
pub fn scan_exes_recursively(drive_c: &Path, dir: &Path, acc: &mut Vec<DiscoveredApp>) {
  if let Ok(entries) = fs::read_dir(dir) {
    for entry in entries.flatten() {
      let path = entry.path();
      if path.is_dir() {
        let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
        if !matches!(name.as_str(), "Windows" | "System32" | "SysWOW64") {
          scan_exes_recursively(drive_c, &path, acc);
        }
      } else if path.is_file() {
        if let Some(ext) = path.extension() {
          if ext.to_string_lossy().to_lowercase() == "exe" {
            let file_name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
            let lower = file_name.to_lowercase();
            if lower.contains("uninstall")
              || lower.contains("helper")
              || lower.contains("setup")
              || lower.contains("redist")
            {
              continue;
            }
            let windows_path = unix_path_to_windows(
              drive_c
                .parent()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default()
                .as_str(),
              &path,
            );
            let meta = entry.metadata().ok();
            let size = meta.map(|m| m.len()).unwrap_or(0);
            acc.push(DiscoveredApp {
              name: file_name
                .trim_end_matches(".exe")
                .trim_end_matches(".EXE")
                .to_string(),
              path: windows_path,
              size_bytes: size,
            });
          }
        }
      }
    }
  }
}
