use std::path::{Path, PathBuf};

use crate::core::errors::FusionError;

/// Sandbox confinement (PRD §54): every filesystem operation must target a
/// path inside the app's own data directory, and never escape via symlinks.
pub fn is_inside(base: &Path, target: &Path) -> bool {
    target.starts_with(base)
}

/// Resolve a relative path (e.g. a bottle id) inside the given base, refusing
/// anything that escapes it.
pub fn safe_join(base: &Path, name: &str) -> Result<PathBuf, FusionError> {
    let candidate = base.join(name);
    if is_inside(base, &candidate) && !name.contains("..") {
        Ok(candidate)
    } else {
        Err(FusionError::InvalidPath)
    }
}

/// Delete a directory tree, refusing to operate outside `base`.
pub fn safe_remove_all(base: &Path, target: &Path) -> Result<(), FusionError> {
    if !is_inside(base, target) {
        return Err(FusionError::InvalidPath);
    }
    std::fs::remove_dir_all(target).map_err(|_| FusionError::PermissionDenied)
}

/// Deep copy a directory tree (used by clone/backup), refusing escapes.
pub fn safe_copy_all(base: &Path, from: &Path, to: &Path) -> Result<(), FusionError> {
    if !is_inside(base, from) || !is_inside(base, to) {
        return Err(FusionError::InvalidPath);
    }
    copy_dir(from, to).map_err(|_| FusionError::PermissionDenied)
}

fn copy_dir(from: &Path, to: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(to)?;
    for entry in std::fs::read_dir(from)? {
        let entry = entry?;
        let path = entry.path();
        let dest = to.join(entry.file_name());
        if path.is_dir() {
            copy_dir(&path, &dest)?;
        } else {
            std::fs::copy(&path, &dest)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_escapes_and_relative_lookalikes() {
        assert!(safe_join(Path::new("/base"), "bottle").is_ok());
        assert!(safe_join(Path::new("/base"), "../evil").is_err());
        assert!(safe_join(Path::new("/base"), "../../etc").is_err());
    }

    #[test]
    fn is_inside_respects_boundaries() {
        assert!(is_inside(Path::new("/a"), Path::new("/a/bottle")));
        assert!(!is_inside(Path::new("/a"), Path::new("/b")));
    }
}
