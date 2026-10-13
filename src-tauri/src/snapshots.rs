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
    bottles_base: &Path,
    snapshots_dir: &Path,
    snapshot_path: &Path,
    bottle: &Bottle,
) -> Result<(), FusionError> {
    let bottle_path = paths::safe_join(bottles_base, &bottle.id)?;
    if !paths::same_file(&bottle_path, Path::new(&bottle.path))
        || !paths::is_inside(snapshots_dir, snapshot_path)
    {
        return Err(FusionError::InvalidPath);
    }
    let staging = paths::safe_join(bottles_base, &format!(".restore-{}", new_id()))?;
    std::fs::create_dir(&staging).map_err(|_| FusionError::PermissionDenied)?;
    if let Err(error) = archives::extract_archive(snapshot_path, &staging) {
        let _ = std::fs::remove_dir_all(&staging);
        return Err(error);
    }

    // Only replace the live prefix after the entire archive passes validation.
    let previous = paths::safe_join(bottles_base, &format!(".previous-{}", new_id()))?;
    let had_previous = bottle_path.exists();
    if had_previous && std::fs::rename(&bottle_path, &previous).is_err() {
        let _ = std::fs::remove_dir_all(&staging);
        return Err(FusionError::PermissionDenied);
    }
    if std::fs::rename(&staging, &bottle_path).is_err() {
        if had_previous {
            if let Err(error) = std::fs::rename(&previous, &bottle_path) {
                eprintln!(
                    "Restore rollback failed ({error}); original bottle preserved at {}",
                    previous.display()
                );
            }
        }
        let _ = std::fs::remove_dir_all(&staging);
        return Err(FusionError::PermissionDenied);
    }
    if had_previous {
        if let Err(error) = paths::safe_remove_all(bottles_base, &previous) {
            eprintln!(
                "Restored snapshot; old prefix remains at {}: {error}",
                previous.display()
            );
        }
    }
    Ok(())
}

/// Delete a stored snapshot file (sandbox-confined).
pub fn delete_snapshot(snapshots_dir: &Path, snapshot_path: &Path) -> Result<(), FusionError> {
    if !paths::is_inside(snapshots_dir, snapshot_path) {
        return Err(FusionError::InvalidPath);
    }
    std::fs::remove_file(snapshot_path).map_err(|_| FusionError::PermissionDenied)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn invalid_snapshot_preserves_live_prefix_and_valid_snapshot_replaces_it() {
        let root = std::env::temp_dir().join(format!("fc_restore_{}", new_id()));
        let bottles = root.join("bottles");
        let snapshots = root.join("snapshots");
        let prefix = bottles.join("test");
        std::fs::create_dir_all(prefix.join("drive_c")).unwrap();
        std::fs::create_dir_all(&snapshots).unwrap();
        std::fs::write(prefix.join("drive_c/original.exe"), b"original").unwrap();
        let bottle: Bottle =
            serde_json::from_value(serde_json::json!({"id":"test", "name":"Test", "path":prefix}))
                .unwrap();
        let archive = snapshots.join("test.tar.gz");
        std::fs::write(&archive, b"not an archive").unwrap();
        assert!(restore_snapshot(&bottles, &snapshots, &archive, &bottle).is_err());
        assert_eq!(
            std::fs::read(prefix.join("drive_c/original.exe")).unwrap(),
            b"original"
        );
        let source = root.join("source");
        std::fs::create_dir_all(source.join("drive_c")).unwrap();
        std::fs::write(source.join("drive_c/restored.exe"), b"restored").unwrap();
        archives::create_tar_gz(&source, &archive).unwrap();
        restore_snapshot(&bottles, &snapshots, &archive, &bottle).unwrap();
        assert_eq!(
            std::fs::read(prefix.join("drive_c/restored.exe")).unwrap(),
            b"restored"
        );
        assert!(!prefix.join("drive_c/original.exe").exists());
        assert_eq!(std::fs::read_dir(&bottles).unwrap().count(), 1);
        std::fs::remove_dir_all(root).unwrap();
    }
}
