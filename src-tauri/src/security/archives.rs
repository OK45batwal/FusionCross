use std::io::Read;
use std::path::{Path, PathBuf};

use crate::core::errors::FusionError;

/// Verify a file's SHA-256 against an expected digest using the platform
/// `shasum` binary. Non-matches are a hard error (PRD §54).
#[allow(dead_code)]
pub fn verify_sha256(path: &Path, expected: &str) -> Result<(), FusionError> {
    let out = std::process::Command::new("shasum")
        .arg("-a").arg("256")
        .arg(path)
        .output()
        .map_err(|_| FusionError::RuntimeVerificationFailed)?;
    let stdout = String::from_utf8_lossy(&out.stdout);
    let got = stdout.split_whitespace().next().unwrap_or_default();
    if got.eq_ignore_ascii_case(&expected.trim()) && !expected.trim().is_empty() {
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

/// Extract an archive into `dest`, refusing any entry that would escape it.
/// Symlinks are skipped (no path traversal, no surprising links inside a runtime).
pub fn extract_archive(archive: &Path, dest: &Path) -> Result<(), FusionError> {
    std::fs::create_dir_all(dest).map_err(|_| FusionError::PermissionDenied)?;
    match detect_kind(archive).ok_or(FusionError::ArchiveValidationFailed)? {
        ArchiveKind::TarXz => extract_tar(decoder::xz(archive)?, archive, dest),
        ArchiveKind::TarGz => extract_tar(decoder::gz(archive)?, archive, dest),
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

fn extract_tar(reader: Box<dyn Read + Send>, archive: &Path, dest: &Path) -> Result<(), FusionError> {
    let mut ar = tar::Archive::new(reader);
    let dest_canon = dest.canonicalize().unwrap_or_else(|_| dest.to_path_buf());
    for entry in ar
        .entries()
        .map_err(|_| FusionError::ArchiveValidationFailed)?
    {
        let mut entry = entry.map_err(|_| FusionError::ArchiveValidationFailed)?;
        let path = entry.path().map_err(|_| FusionError::ArchiveValidationFailed)?.into_owned();
        if path.is_absolute() || path.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
            return Err(FusionError::ArchiveValidationFailed);
        }
        // skip any symlink entries outright
        use tar::EntryType;
        if entry.header().entry_type() != EntryType::Regular && entry.header().entry_type() != EntryType::Directory {
            continue;
        }
        let target: PathBuf = dest_canon.join(&path);
        if !target.starts_with(&dest_canon) {
            return Err(FusionError::ArchiveValidationFailed);
        }
        match entry.header().entry_type() {
            EntryType::Directory => {
                std::fs::create_dir_all(&target).map_err(|_| FusionError::ArchiveValidationFailed)?;
            }
            _ => {
                if let Some(parent) = target.parent() {
                    std::fs::create_dir_all(parent).map_err(|_| FusionError::ArchiveValidationFailed)?;
                }
                entry.unpack(&target).map_err(|_| FusionError::ArchiveValidationFailed)?;
            }
        }
    }
    let _ = archive;
    Ok(())
}

/// Create a `.tar.gz` of a directory — used for bottle snapshots/backups.
/// Fails if the source escapes... the source is expected to be a bottle path
/// already validated by the caller via `paths::is_inside`.
pub fn create_tar_gz(src_dir: &Path, out_file: &Path) -> Result<(), FusionError> {
    let file = std::fs::File::create(out_file).map_err(|_| FusionError::PermissionDenied)?;
    let enc = flate2::write::GzEncoder::new(file, flate2::Compression::default());
    let mut builder = tar::Builder::new(enc);
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::ids::new_id;

    #[test]
    fn detects_kinds() {
        assert_eq!(detect_kind(Path::new("/x/wine.tar.xz")), Some(ArchiveKind::TarXz));
        assert_eq!(detect_kind(Path::new("/x/wine.tar.gz")), Some(ArchiveKind::TarGz));
        assert_eq!(detect_kind(Path::new("/x/wine.tgz")), Some(ArchiveKind::TarGz));
        assert_eq!(detect_kind(Path::new("/x/wine.zip")), Some(ArchiveKind::Zip));
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
}