use std::path::Path;

use crate::core::errors::FusionError;
use crate::core::ids::new_id;
use crate::core::paths;
use crate::security::archives;

/// Snapshot a bottle prefix as a compressed archive (PRD §41). The archive
/// lives under the app's own snapshots dir; the caller resolves and validates
/// `prefix` (current or migrated library) before calling this.
pub fn create_snapshot(prefix: &Path, snapshots_dir: &Path) -> Result<(String, u64), FusionError> {
    if !is_plain_directory(prefix) {
        return Err(FusionError::InvalidPath);
    }

    let id = new_id();
    let archive = snapshots_dir.join(format!("{id}.tar.gz"));
    archives::create_tar_gz(prefix, &archive)?;
    let size = std::fs::metadata(&archive).map(|m| m.len()).unwrap_or(0);
    Ok((archive.to_string_lossy().into_owned(), size))
}

/// Replace a bottle's contents with a snapshot (restore). Destructive but
/// confined to the bottle's own directory.
pub fn restore_snapshot(
    prefix: &Path,
    snapshots_dir: &Path,
    snapshot_path: &Path,
) -> Result<(), FusionError> {
    if !is_plain_directory(prefix) || !paths::is_inside(snapshots_dir, snapshot_path) {
        return Err(FusionError::InvalidPath);
    }
    let bottles_base = prefix.parent().ok_or(FusionError::InvalidPath)?;
    let staging = paths::safe_join(bottles_base, &format!(".restore-{}", new_id()))?;
    std::fs::create_dir(&staging).map_err(|_| FusionError::PermissionDenied)?;
    if let Err(error) = archives::extract_snapshot_archive(snapshot_path, &staging) {
        let _ = std::fs::remove_dir_all(&staging);
        return Err(error);
    }

    // Only replace the live prefix after the entire archive passes validation.
    let previous = paths::safe_join(bottles_base, &format!(".previous-{}", new_id()))?;
    let had_previous = prefix.exists();
    if had_previous && std::fs::rename(prefix, &previous).is_err() {
        let _ = std::fs::remove_dir_all(&staging);
        return Err(FusionError::PermissionDenied);
    }
    if std::fs::rename(&staging, prefix).is_err() {
        if had_previous {
            if let Err(error) = std::fs::rename(&previous, prefix) {
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

fn is_plain_directory(path: &Path) -> bool {
    std::fs::symlink_metadata(path)
        .map(|metadata| metadata.is_dir() && !metadata.file_type().is_symlink())
        .unwrap_or(false)
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
        let archive = snapshots.join("test.tar.gz");
        std::fs::write(&archive, b"not an archive").unwrap();
        assert!(restore_snapshot(&prefix, &snapshots, &archive).is_err());
        assert_eq!(
            std::fs::read(prefix.join("drive_c/original.exe")).unwrap(),
            b"original"
        );
        let source = root.join("source");
        std::fs::create_dir_all(source.join("drive_c")).unwrap();
        std::fs::write(source.join("drive_c/restored.exe"), b"restored").unwrap();
        archives::create_tar_gz(&source, &archive).unwrap();
        restore_snapshot(&prefix, &snapshots, &archive).unwrap();
        assert_eq!(
            std::fs::read(prefix.join("drive_c/restored.exe")).unwrap(),
            b"restored"
        );
        assert!(!prefix.join("drive_c/original.exe").exists());
        assert_eq!(std::fs::read_dir(&bottles).unwrap().count(), 1);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn snapshot_keeps_wine_symlinks_without_copying_their_targets() {
        let root = std::env::temp_dir().join(format!("fc_snapshot_link_{}", new_id()));
        let snapshots = root.join("snapshots");
        let source = root.join("source");
        std::fs::create_dir_all(source.join("drive_c")).unwrap();
        std::fs::create_dir_all(source.join("dosdevices")).unwrap();
        std::fs::create_dir_all(&snapshots).unwrap();
        std::fs::write(source.join("drive_c/game.exe"), b"game").unwrap();
        std::os::unix::fs::symlink("../drive_c", source.join("dosdevices/c")).unwrap();
        let outside = root.join("secret.txt");
        std::fs::write(&outside, b"secret").unwrap();
        std::os::unix::fs::symlink(&outside, source.join("dosdevices/z")).unwrap();

        let archive = snapshots.join("links.tar.gz");
        archives::create_tar_gz(&source, &archive).unwrap();
        let mut bodies = String::new();
        let mut tar = tar::Archive::new(flate2::read::GzDecoder::new(
            std::fs::File::open(&archive).unwrap(),
        ));
        for entry in tar.entries().unwrap() {
            let mut entry = entry.unwrap();
            if entry.header().entry_type().is_file() {
                let mut text = String::new();
                std::io::Read::read_to_string(&mut entry, &mut text).unwrap();
                bodies.push_str(&text);
            }
        }
        assert!(!bodies.contains("secret"));

        let restored = root.join("restored");
        archives::extract_snapshot_archive(&archive, &restored).unwrap();
        assert_eq!(
            std::fs::read(restored.join("drive_c/game.exe")).unwrap(),
            b"game"
        );
        let link = restored.join("dosdevices/c");
        assert!(std::fs::symlink_metadata(&link)
            .unwrap()
            .file_type()
            .is_symlink());
        assert_eq!(std::fs::read_link(link).unwrap(), Path::new("../drive_c"));
        assert!(std::fs::symlink_metadata(restored.join("dosdevices/z"))
            .unwrap()
            .file_type()
            .is_symlink());

        std::fs::remove_dir_all(root).ok();
    }
}
