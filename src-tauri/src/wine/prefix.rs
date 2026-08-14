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
