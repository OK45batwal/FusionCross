use std::path::Path;
use std::process::Command;

use crate::core::errors::FusionError;

/// A prefix is considered initialized once Wine produced its `drive_c`.
pub fn prefix_prepared(prefix: &Path) -> bool {
    prefix.join("drive_c").join("windows").exists()
}

/// Initialize a Wine prefix with `wineboot -i`. Idempotent.
pub fn init_prefix(wine_binary: &str, prefix: &Path) -> Result<(), FusionError> {
    std::fs::create_dir_all(prefix).map_err(|_| FusionError::PermissionDenied)?;
    if prefix_prepared(prefix) {
        return Ok(());
    }
    let out = Command::new(wine_binary)
        .env("WINEPREFIX", prefix)
        .arg("wineboot")
        .arg("-i")
        .output()
        .map_err(|_| FusionError::RuntimeNotFound)?;
    if out.status.success() && prefix_prepared(prefix) {
        Ok(())
    } else {
        Err(FusionError::LaunchFailed)
    }
}

/// Apply winetricks verbs with sanitized arguments (no shell involved).
/// Missing winetricks is tolerated — dependencies are best-effort.
pub fn install_verbs(
    _wine_binary: &str,
    prefix: &Path,
    verbs: &[String],
) -> Result<(), FusionError> {
    if verbs.is_empty() {
        return Ok(());
    }
    let out = Command::new("winetricks")
        .env("WINEPREFIX", prefix)
        .env("WINEDLLOVERRIDES", "mscoree,mshtml=")
        .arg("-q")
        .args(verbs)
        .output();
    match out {
        // winetricks not installed → skip; the bottle still works.
        Err(_) => Ok(()),
        Ok(o) if o.status.success() => Ok(()),
        _ => Err(FusionError::DependencyMissing),
    }
}

/// Kill all active Wine processes and the wineserver daemon for this bottle prefix.
pub fn kill_wineserver(wine_binary: &str, prefix: &Path) -> Result<(), FusionError> {
    let wineserver_bin = Path::new(wine_binary)
        .parent()
        .map(|p| p.join("wineserver"))
        .filter(|p| p.exists())
        .unwrap_or_else(|| std::path::PathBuf::from("wineserver"));

    let _ = Command::new(&wineserver_bin)
        .env("WINEPREFIX", prefix)
        .arg("-k")
        .output();

    // Fallback: wineboot -k (force kill)
    let _ = Command::new(wine_binary)
        .env("WINEPREFIX", prefix)
        .arg("wineboot")
        .arg("-k")
        .output();

    Ok(())
}

/// Permitted interactive tools within a bottle.
pub const ALLOWED_WINE_TOOLS: [&str; 5] = ["winecfg", "regedit", "cmd", "taskmgr", "control"];

/// Launch standard Windows/Wine configuration utility inside a bottle.
pub fn launch_wine_tool(wine_binary: &str, prefix: &Path, tool: &str) -> Result<u32, FusionError> {
    if !ALLOWED_WINE_TOOLS.contains(&tool) {
        return Err(FusionError::Unsupported);
    }

    let mut cmd = Command::new(wine_binary);
    cmd.env("WINEPREFIX", prefix);
    cmd.env("WINEDLLOVERRIDES", "mscoree,mshtml=");
    cmd.arg(tool);
    cmd.stdin(std::process::Stdio::null());
    cmd.stdout(std::process::Stdio::null());
    cmd.stderr(std::process::Stdio::null());

    let child = cmd.spawn().map_err(|_| FusionError::LaunchFailed)?;
    Ok(child.id())
}

/// Ensure Direct3D settings and DLL overrides exist in prefix user.reg for modern gaming (DirectX 10/11/12).
pub fn ensure_graphics_registry(prefix: &Path, _graphics: &str) -> Result<(), FusionError> {
    let user_reg = prefix.join("user.reg");
    if !user_reg.exists() {
        return Ok(());
    }
    let content = match std::fs::read_to_string(&user_reg) {
        Ok(c) => c,
        Err(_) => return Ok(()),
    };

    let mut updated = content.clone();

    // Direct3D settings
    if !updated.contains("\"Direct3D11\"") {
        let d3d_block = "\n[Software\\\\Wine\\\\Direct3D] 1790614100\n\
#time=1dd4e9b00000000\n\
\"CheckFloatConstants\"=\"disabled\"\n\
\"Direct3D10\"=\"1\"\n\
\"Direct3D11\"=\"1\"\n\
\"MaxShaderModelCS\"=\"5\"\n\
\"MaxShaderModelDS\"=\"5\"\n\
\"MaxShaderModelGS\"=\"5\"\n\
\"MaxShaderModelHS\"=\"5\"\n\
\"MaxShaderModelPS\"=\"5\"\n\
\"MaxShaderModelVS\"=\"5\"\n\
\"VideoMemorySize\"=\"4096\"\n\
\"csmt\"=dword:00000001\n";
        updated.push_str(d3d_block);
    }

    // DLL Overrides for Metal / DXMT / DXVK
    let has_d3d_override = updated.contains("\"*d3d11\"") || updated.contains("\"d3d11\"");
    if !has_d3d_override {
        let overrides = "\"*d3d10\"=\"native,builtin\"\n\
\"*d3d10_1\"=\"native,builtin\"\n\
\"*d3d10core\"=\"native,builtin\"\n\
\"*d3d11\"=\"native,builtin\"\n\
\"*d3d12\"=\"native,builtin\"\n\
\"*d3d12core\"=\"native,builtin\"\n\
\"*d3d9\"=\"native,builtin\"\n\
\"*dxgi\"=\"native,builtin\"\n\
\"*winemetal\"=\"native,builtin\"\n\
\"d3d10\"=\"native,builtin\"\n\
\"d3d10_1\"=\"native,builtin\"\n\
\"d3d10core\"=\"native,builtin\"\n\
\"d3d11\"=\"native,builtin\"\n\
\"d3d12\"=\"native,builtin\"\n\
\"d3d12core\"=\"native,builtin\"\n\
\"d3d9\"=\"native,builtin\"\n\
\"dxgi\"=\"native,builtin\"\n\
\"winemetal\"=\"native,builtin\"\n\
\"mscoree\"=\"\"\n\
\"mshtml\"=\"\"\n";

        let target = "[Software\\\\Wine\\\\DllOverrides]";
        if let Some(idx) = updated.find(target) {
            let end_of_line = updated[idx..]
                .find('\n')
                .map(|i| idx + i + 1)
                .unwrap_or(idx + target.len());
            updated.insert_str(end_of_line, overrides);
        } else {
            let section = format!("\n[Software\\\\Wine\\\\DllOverrides] 1790614100\n#time=1dd4e9b00000000\n{}", overrides);
            updated.push_str(&section);
        }
    }

    if updated != content {
        std::fs::write(&user_reg, updated).map_err(|_| FusionError::LaunchFailed)?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ensure_graphics_registry_creates_d3d_sections() {
        let temp = std::env::temp_dir().join(format!(
            "fc_test_prefix_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&temp).unwrap();
        let user_reg = temp.join("user.reg");
        std::fs::write(
            &user_reg,
            "WINE REGISTRY Version 2\n[Console]\n\"CloseOnExit\"=dword:00000001\n",
        )
        .unwrap();

        assert!(ensure_graphics_registry(&temp, "d3dmetal").is_ok());

        let content = std::fs::read_to_string(&user_reg).unwrap();
        assert!(content.contains("[Software\\\\Wine\\\\Direct3D]"));
        assert!(content.contains("\"Direct3D11\"=\"1\""));
        assert!(content.contains("\"MaxShaderModelVS\"=\"5\""));
        assert!(content.contains("[Software\\\\Wine\\\\DllOverrides]"));
        assert!(content.contains("\"*d3d11\"=\"native,builtin\""));

        // Idempotent: running again does not duplicate sections
        assert!(ensure_graphics_registry(&temp, "d3dmetal").is_ok());
        let content_after = std::fs::read_to_string(&user_reg).unwrap();
        assert_eq!(content, content_after);

        std::fs::remove_dir_all(&temp).ok();
    }

    #[test]
    fn test_ensure_graphics_registry_populates_empty_dlloverrides_section() {
        let temp = std::env::temp_dir().join(format!(
            "fc_test_prefix_empty_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&temp).unwrap();
        let user_reg = temp.join("user.reg");
        std::fs::write(
            &user_reg,
            "WINE REGISTRY Version 2\n[Software\\\\Wine\\\\DllOverrides] 123456\n#time=1234\n\n[Other]\n",
        )
        .unwrap();

        assert!(ensure_graphics_registry(&temp, "d3dmetal").is_ok());
        let content = std::fs::read_to_string(&user_reg).unwrap();
        assert!(content.contains("\"*d3d11\"=\"native,builtin\""));
        assert!(content.contains("\"*dxgi\"=\"native,builtin\""));
        assert!(content.contains("[Software\\\\Wine\\\\Direct3D]"));

        std::fs::remove_dir_all(&temp).ok();
    }
}
