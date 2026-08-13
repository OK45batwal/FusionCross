use std::path::Path;

use crate::core::errors::FusionError;
use crate::core::ids::new_id;
use crate::core::paths;
use crate::core::state::Bottle;
use crate::security::archives;

/// Snapshot a bottle prefix as a compressed archive (PRD §41). The archive
/// lives under the app's own snapshots dir; paths are sandbox-verified.
pub fn create_snapshot(
    bottles_base: &Path,
    snapshots_dir: &Path,
    bottle: &Bottle,
) -> Result<(String, u64), FusionError> {
    paths::safe_join(bottles_base, &bottle.id)?;
    let bottle_path = Path::new(&bottle.path);
    if !paths::is_inside(bottles_base, bottle_path) {
        return Err(FusionError::InvalidPath);
    }

    let id = new_id();
    let archive = snapshots_dir.join(format!("{id}.tar.gz"));
    archives::create_tar_gz(bottle_path, &archive)?;
    let size = std::fs::metadata(&archive).map(|m| m.len()).unwrap_or(0);
    Ok((archive.to_string_lossy().into_owned(), size))
}

/// Replace a bottle's contents with a snapshot (restore). Destructive but
/// confined to the bottle's own directory.
pub fn restore_snapshot(
    snapshots_dir: &Path,
    snapshot_path: &Path,
    bottle: &Bottle,
) -> Result<(), FusionError> {
    let _ = snapshots_dir;
    let bottle_path = Path::new(&bottle.path);
    if !bottle_path.exists() {
        std::fs::create_dir_all(bottle_path).map_err(|_| FusionError::PermissionDenied)?;
    }
    for entry in std::fs::read_dir(bottle_path).map_err(|_| FusionError::PermissionDenied)? {
        let entry = entry.map_err(|_| FusionError::PermissionDenied)?;
        let p = entry.path();
        if !paths::is_inside(bottle_path, &p) {
            return Err(FusionError::InvalidPath);
        }
        if p.is_dir() {
            std::fs::remove_dir_all(&p).map_err(|_| FusionError::PermissionDenied)?;
        } else {
            std::fs::remove_file(&p).map_err(|_| FusionError::PermissionDenied)?;
        }
    }
    archives::extract_archive(snapshot_path, bottle_path)
}

/// Delete a stored snapshot file (sandbox-confined).
pub fn delete_snapshot(snapshots_dir: &Path, snapshot_path: &Path) -> Result<(), FusionError> {
    if !paths::is_inside(snapshots_dir, snapshot_path) {
        return Err(FusionError::InvalidPath);
    }
    std::fs::remove_file(snapshot_path).map_err(|_| FusionError::PermissionDenied)
}