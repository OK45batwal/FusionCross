use std::io::Read;
use std::path::{Path, PathBuf};

use crate::core::errors::FusionError;

const RUNTIME_LIMITS: Limits = Limits {
    max_entries: 20_000,
    max_bytes: 8 * 1024 * 1024 * 1024,
};

/// A Wine prefix stores games, so it can be far larger than a runtime tarball.
/// The same bounds are enforced when creating a snapshot, which guarantees
/// that every archive we write can be restored.
const SNAPSHOT_LIMITS: Limits = Limits {
    max_entries: 500_000,
    max_bytes: 256 * 1024 * 1024 * 1024,
};

#[derive(Debug, Clone, Copy)]
struct Limits {
    max_entries: usize,
    max_bytes: u64,
}

/// Verify a file's SHA-256 against an expected digest using the platform
/// `shasum` binary. Non-matches are a hard error (PRD §54).
#[allow(dead_code, unused)]
pub fn verify_sha256(path: &Path, expected: &str) -> Result<(), FusionError> {
    let out = std::process::Command::new("shasum")
        .arg("-a")
        .arg("256")
        .arg(path)
        .output()
        .map_err(|_| FusionError::RuntimeVerificationFailed)?;
    let stdout = String::from_utf8_lossy(&out.stdout);
    let got = stdout.split_whitespace().next().unwrap_or_default();
    if got.eq_ignore_ascii_case(expected.trim()) && !expected.trim().is_empty() {
        Ok(())
    } else {
        Err(FusionError::RuntimeVerificationFailed)
    }
}

/// Compressed archive types we can safely extract.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ArchiveKind {
    TarXz,
    TarGz,
    Zip,
}

pub fn detect_kind(path: &Path) -> Option<ArchiveKind> {
    let name = path.file_name()?.to_string_lossy().to_ascii_lowercase();
    if name.ends_with(".tar.xz") {
        Some(ArchiveKind::TarXz)
    } else if name.ends_with(".tar.gz") || name.ends_with(".tgz") {
        Some(ArchiveKind::TarGz)
    } else if name.ends_with(".zip") {
        Some(ArchiveKind::Zip)
    } else {
        None
    }
}

/// Extract a runtime archive into `dest`, refusing any entry that would
/// escape it. Symlinks are skipped: runtime tarballs have no legitimate links
/// and must not plant them in the app data directory.
pub fn extract_archive(archive: &Path, dest: &Path) -> Result<(), FusionError> {
    extract_with(archive, dest, RUNTIME_LIMITS, false)
}

/// Extract a bottle snapshot. Unlike runtimes, Wine prefixes rely on symlinks
/// (`dosdevices/c:` points at `drive_c`, `z:` at the host root), so they are
/// recreated without ever being traversed during extraction.
pub fn extract_snapshot_archive(archive: &Path, dest: &Path) -> Result<(), FusionError> {
    extract_with(archive, dest, SNAPSHOT_LIMITS, true)
}

fn extract_with(
    archive: &Path,
    dest: &Path,
    limits: Limits,
    preserve_symlinks: bool,
) -> Result<(), FusionError> {
    match std::fs::symlink_metadata(dest) {
        Ok(metadata) if metadata.file_type().is_symlink() || !metadata.file_type().is_dir() => {
            return Err(FusionError::ArchiveValidationFailed);
        }
        Ok(_) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            std::fs::create_dir_all(dest).map_err(|_| FusionError::PermissionDenied)?;
        }
        Err(_) => return Err(FusionError::PermissionDenied),
    }
    match detect_kind(archive).ok_or(FusionError::ArchiveValidationFailed)? {
        ArchiveKind::TarXz => extract_tar(decoder::xz(archive)?, dest, limits, preserve_symlinks),
        ArchiveKind::TarGz => extract_tar(decoder::gz(archive)?, dest, limits, preserve_symlinks),
        ArchiveKind::Zip => Err(FusionError::Unsupported),
    }
}

mod decoder {
    use super::*;

    pub fn xz(path: &Path) -> Result<Box<dyn Read + Send>, FusionError> {
        let file = std::fs::File::open(path).map_err(|_| FusionError::ArchiveValidationFailed)?;
        Ok(Box::new(xz2::read::XzDecoder::new(file)))
    }

    pub fn gz(path: &Path) -> Result<Box<dyn Read + Send>, FusionError> {
        let file = std::fs::File::open(path).map_err(|_| FusionError::ArchiveValidationFailed)?;
        Ok(Box::new(flate2::read::GzDecoder::new(file)))
    }
}

fn extract_tar(
    reader: Box<dyn Read + Send>,
    dest: &Path,
    limits: Limits,
    preserve_symlinks: bool,
) -> Result<(), FusionError> {
    let mut ar = tar::Archive::new(reader);
    let dest_canon = dest.canonicalize().unwrap_or_else(|_| dest.to_path_buf());
    let mut entry_count = 0usize;
    let mut extracted_bytes = 0u64;
    for entry in ar
        .entries()
        .map_err(|_| FusionError::ArchiveValidationFailed)?
    {
        let mut entry = entry.map_err(|_| FusionError::ArchiveValidationFailed)?;
        entry_count = entry_count
            .checked_add(1)
            .ok_or(FusionError::ArchiveValidationFailed)?;
        if entry_count > limits.max_entries {
            return Err(FusionError::ArchiveValidationFailed);
        }
        extracted_bytes = extracted_bytes
            .checked_add(entry.size())
            .ok_or(FusionError::ArchiveValidationFailed)?;
        if extracted_bytes > limits.max_bytes {
            return Err(FusionError::ArchiveValidationFailed);
        }
        let path = entry
            .path()
            .map_err(|_| FusionError::ArchiveValidationFailed)?
            .into_owned();
        if path.is_absolute()
            || path
                .components()
                .any(|c| matches!(c, std::path::Component::ParentDir))
        {
            return Err(FusionError::ArchiveValidationFailed);
        }
        // Hardlinks, devices and other special entries have no place in a
        // prefix snapshot; skip them rather than guessing at their target.
        use tar::EntryType;
        let entry_type = entry.header().entry_type();
        let is_symlink = entry_type == EntryType::Symlink;
        if entry_type != EntryType::Regular
            && entry_type != EntryType::Directory
            && !(preserve_symlinks && is_symlink)
        {
            continue;
        }
        let target: PathBuf = dest_canon.join(&path);
        if !target.starts_with(&dest_canon) {
            return Err(FusionError::ArchiveValidationFailed);
        }
        match entry_type {
            EntryType::Directory => {
                ensure_directory(&dest_canon, &target)?;
            }
            EntryType::Symlink => {
                let link = entry
                    .link_name()
                    .map_err(|_| FusionError::ArchiveValidationFailed)?
                    .ok_or(FusionError::ArchiveValidationFailed)?
                    .into_owned();
                if let Some(parent) = target.parent() {
                    ensure_directory(&dest_canon, parent)?;
                }
                if std::fs::symlink_metadata(&target).is_ok() {
                    return Err(FusionError::ArchiveValidationFailed);
                }
                // Recreate the link; never write through it. Later entries
                // whose parent resolves to a symlink are rejected above.
                std::os::unix::fs::symlink(&link, &target)
                    .map_err(|_| FusionError::ArchiveValidationFailed)?;
            }
            _ => {
                if let Some(parent) = target.parent() {
                    ensure_directory(&dest_canon, parent)?;
                }
                if std::fs::symlink_metadata(&target)
                    .map(|metadata| metadata.file_type().is_symlink())
                    .unwrap_or(false)
                {
                    return Err(FusionError::ArchiveValidationFailed);
                }
                entry
                    .unpack(&target)
                    .map_err(|_| FusionError::ArchiveValidationFailed)?;
            }
        }
    }
    Ok(())
}

/// Create every component beneath `dest` without following an existing
/// symlink. This protects restore operations where `dest` already contains
/// user-controlled Wine prefix data.
fn ensure_directory(dest: &Path, target: &Path) -> Result<(), FusionError> {
    let relative = target
        .strip_prefix(dest)
        .map_err(|_| FusionError::ArchiveValidationFailed)?;
    let mut current = dest.to_path_buf();
    for component in relative.components() {
        let std::path::Component::Normal(segment) = component else {
            return Err(FusionError::ArchiveValidationFailed);
        };
        current.push(segment);
        match std::fs::symlink_metadata(&current) {
            Ok(metadata) if metadata.file_type().is_symlink() || !metadata.file_type().is_dir() => {
                return Err(FusionError::ArchiveValidationFailed);
            }
            Ok(_) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                std::fs::create_dir(&current).map_err(|_| FusionError::ArchiveValidationFailed)?;
            }
            Err(_) => return Err(FusionError::ArchiveValidationFailed),
        }
    }
    Ok(())
}

/// Create a `.tar.gz` of a directory — used for bottle snapshots/backups.
/// Symlinks are archived as links (Wine needs them) and never followed, so a
/// prefix's `dosdevices/z:` cannot pull the host filesystem into a backup.
/// The tree is measured first against the same limits restore enforces.
pub fn create_tar_gz(src_dir: &Path, out_file: &Path) -> Result<(), FusionError> {
    measure_tree(src_dir, SNAPSHOT_LIMITS)?;
    let file = std::fs::File::create(out_file).map_err(|_| FusionError::PermissionDenied)?;
    let enc = flate2::write::GzEncoder::new(file, flate2::Compression::default());
    let mut builder = tar::Builder::new(enc);
    builder.follow_symlinks(false);
    builder
        .append_dir_all(".", src_dir)
        .map_err(|_| FusionError::PermissionDenied)?;
    let encoder = builder
        .into_inner()
        .map_err(|_| FusionError::PermissionDenied)?;
    encoder
        .finish()
        .map_err(|_| FusionError::PermissionDenied)?;
    Ok(())
}

/// Count entries and regular-file bytes without following symlinks.
fn measure_tree(root: &Path, limits: Limits) -> Result<(usize, u64), FusionError> {
    let mut stack = vec![root.to_path_buf()];
    let mut entries = 0usize;
    let mut bytes = 0u64;
    while let Some(path) = stack.pop() {
        let metadata =
            std::fs::symlink_metadata(&path).map_err(|_| FusionError::PermissionDenied)?;
        entries += 1;
        if entries > limits.max_entries {
            return Err(FusionError::ArchiveValidationFailed);
        }
        if metadata.file_type().is_symlink() {
            continue;
        }
        if metadata.is_dir() {
            let children = std::fs::read_dir(&path).map_err(|_| FusionError::PermissionDenied)?;
            for child in children {
                stack.push(child.map_err(|_| FusionError::PermissionDenied)?.path());
            }
        } else {
            bytes = bytes
                .checked_add(metadata.len())
                .ok_or(FusionError::ArchiveValidationFailed)?;
            if bytes > limits.max_bytes {
                return Err(FusionError::ArchiveValidationFailed);
            }
        }
    }
    Ok((entries, bytes))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::ids::new_id;

    #[test]
    fn detects_kinds() {
        assert_eq!(
            detect_kind(Path::new("/x/wine.tar.xz")),
            Some(ArchiveKind::TarXz)
        );
        assert_eq!(
            detect_kind(Path::new("/x/wine.tar.gz")),
            Some(ArchiveKind::TarGz)
        );
        assert_eq!(
            detect_kind(Path::new("/x/wine.tgz")),
            Some(ArchiveKind::TarGz)
        );
        assert_eq!(
            detect_kind(Path::new("/x/wine.zip")),
            Some(ArchiveKind::Zip)
        );
        assert_eq!(detect_kind(Path::new("/x/wine.txt")), None);
    }

    #[test]
    fn tar_gz_roundtrip() {
        let dir = std::env::temp_dir().join(format!("fc_tar_{}", new_id()));
        let src = dir.join("src");
        let out = dir.join("snap.tar.gz");
        let dest = dir.join("out");
        std::fs::create_dir_all(src.join("drive_c")).unwrap();
        std::fs::write(src.join("drive_c/hello.txt"), b"hi").unwrap();

        create_tar_gz(&src, &out).unwrap();
        extract_archive(&out, &dest).unwrap();
        assert!(dest.join("drive_c/hello.txt").exists());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[cfg(unix)]
    #[test]
    fn extraction_rejects_existing_symlinked_directories() {
        use std::os::unix::fs::symlink;

        let dir = std::env::temp_dir().join(format!("fc_tar_symlink_{}", new_id()));
        let archive = dir.join("archive.tar.gz");
        let destination = dir.join("destination");
        let outside = dir.join("outside");
        std::fs::create_dir_all(&destination).unwrap();
        std::fs::create_dir_all(&outside).unwrap();
        symlink(&outside, destination.join("escape")).unwrap();

        let encoder = flate2::write::GzEncoder::new(
            std::fs::File::create(&archive).unwrap(),
            flate2::Compression::default(),
        );
        let mut builder = tar::Builder::new(encoder);
        let content = b"must not escape".as_ref();
        let mut header = tar::Header::new_gnu();
        header.set_size(content.len() as u64);
        header.set_mode(0o644);
        header.set_cksum();
        builder
            .append_data(
                &mut header,
                "escape/blocked.txt",
                &mut std::io::Cursor::new(content),
            )
            .unwrap();
        builder.into_inner().unwrap().finish().unwrap();

        let clean = dir.join("clean");
        extract_archive(&archive, &clean).unwrap();
        assert_eq!(
            std::fs::read(clean.join("escape/blocked.txt")).unwrap(),
            content
        );

        assert!(extract_archive(&archive, &destination).is_err());
        assert!(!outside.join("blocked.txt").exists());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn measure_tree_enforces_entry_and_byte_limits() {
        let dir = std::env::temp_dir().join(format!("fc_measure_{}", new_id()));
        let src = dir.join("src");
        std::fs::create_dir_all(&src).unwrap();
        std::fs::write(src.join("a.bin"), b"1234").unwrap();
        std::fs::write(src.join("b.bin"), b"5678").unwrap();

        // root + two files exceed a two-entry budget
        assert!(measure_tree(
            &src,
            Limits {
                max_entries: 2,
                max_bytes: 1024
            }
        )
        .is_err());
        assert!(measure_tree(
            &src,
            Limits {
                max_entries: 100,
                max_bytes: 4
            }
        )
        .is_err());
        assert!(measure_tree(&src, SNAPSHOT_LIMITS).is_ok());

        std::fs::remove_dir_all(&dir).ok();
    }

    #[cfg(unix)]
    #[test]
    fn measure_tree_does_not_follow_symlinks() {
        let dir = std::env::temp_dir().join(format!("fc_measure_link_{}", new_id()));
        let src = dir.join("src");
        std::fs::create_dir_all(&src).unwrap();
        std::fs::write(dir.join("big.bin"), vec![0u8; 4096]).unwrap();
        std::os::unix::fs::symlink(dir.join("big.bin"), src.join("link")).unwrap();
        std::fs::write(src.join("tiny.txt"), b"ok").unwrap();

        let limits = Limits {
            max_entries: 100,
            max_bytes: 10,
        };
        assert!(measure_tree(&src, limits).is_ok());

        std::fs::remove_dir_all(&dir).ok();
    }
}
