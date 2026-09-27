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
