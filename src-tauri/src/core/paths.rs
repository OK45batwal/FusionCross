use std::path::{Component, Path, PathBuf};

use crate::core::errors::FusionError;

pub fn same_file(left: &Path, right: &Path) -> bool {
    left == right
        || match (left.canonicalize(), right.canonicalize()) {
            (Ok(left), Ok(right)) => left == right,
            _ => false,
        }
}

/// Return whether an existing target resolves beneath an existing sandbox root.
///
/// Both paths are canonicalized so a `..` component or symlink cannot turn a
/// lexical child path into a host path outside the sandbox.
pub fn is_inside(base: &Path, target: &Path) -> bool {
    existing_child(base, target).is_ok()
}

/// Resolve a relative path inside `base`. Every existing component is checked
/// with `symlink_metadata`, so callers cannot use a symlink as an escape hatch.
/// The returned path is rooted at the canonical sandbox directory.
pub fn safe_join(base: &Path, relative: &str) -> Result<PathBuf, FusionError> {
    let base = canonical_base(base)?;
    let relative = Path::new(relative);
    validate_relative(relative)?;

    let mut candidate = base.clone();
    for component in relative.components() {
        let Component::Normal(segment) = component else {
            return Err(FusionError::InvalidPath);
        };
        candidate.push(segment);

        match std::fs::symlink_metadata(&candidate) {
            Ok(metadata) if metadata.file_type().is_symlink() => {
                return Err(FusionError::InvalidPath);
            }
            Ok(_) => {
                let resolved = candidate
                    .canonicalize()
                    .map_err(|_| FusionError::InvalidPath)?;
                if !resolved.starts_with(&base) {
                    return Err(FusionError::InvalidPath);
                }
                candidate = resolved;
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(_) => return Err(FusionError::PermissionDenied),
        }
    }
    Ok(candidate)
}

/// Resolve an existing regular file inside `base`.
pub fn safe_file(base: &Path, relative: &str) -> Result<PathBuf, FusionError> {
    let path = safe_join(base, relative)?;
    let metadata = std::fs::symlink_metadata(&path).map_err(|_| FusionError::InvalidPath)?;
    if metadata.file_type().is_file() {
        Ok(path)
    } else {
        Err(FusionError::InvalidPath)
    }
}

/// Delete a directory tree, refusing symlinks and targets outside `base`.
pub fn safe_remove_all(base: &Path, target: &Path) -> Result<(), FusionError> {
    let base = canonical_base(base)?;
    let target = existing_child(&base, target)?;
    if target == base {
        return Err(FusionError::InvalidPath);
    }
    std::fs::remove_dir_all(target).map_err(|_| FusionError::PermissionDenied)
}

/// Copy a prefix without traversing symlinks. Wine drive/user mappings are
/// copied as links; absolute links into the source are rebased to the clone.
pub fn safe_copy_all(base: &Path, from: &Path, to: &Path) -> Result<(), FusionError> {
    let base = canonical_base(base)?;
    let source = existing_child(&base, from)?;
    let destination = new_child(&base, to)?;
    if source == base || destination.starts_with(&source) {
        return Err(FusionError::InvalidPath);
    }
    std::fs::create_dir(&destination).map_err(|_| FusionError::PermissionDenied)?;
    let result = copy_dir(&source, &destination, &source, &destination);
    if result.is_err() {
        let _ = std::fs::remove_dir_all(&destination);
    }
    result
}

fn canonical_base(base: &Path) -> Result<PathBuf, FusionError> {
    let metadata = std::fs::symlink_metadata(base).map_err(|_| FusionError::InvalidPath)?;
    if !metadata.file_type().is_dir() || metadata.file_type().is_symlink() {
        return Err(FusionError::InvalidPath);
    }
    base.canonicalize().map_err(|_| FusionError::InvalidPath)
}

fn validate_relative(path: &Path) -> Result<(), FusionError> {
    let mut saw_component = false;
    for component in path.components() {
        saw_component = true;
        if !matches!(component, Component::Normal(_)) {
            return Err(FusionError::InvalidPath);
        }
    }
    if saw_component {
        Ok(())
    } else {
        Err(FusionError::InvalidPath)
    }
}

fn existing_child(base: &Path, target: &Path) -> Result<PathBuf, FusionError> {
    let base = canonical_base(base)?;
    let metadata = std::fs::symlink_metadata(target).map_err(|_| FusionError::InvalidPath)?;
    if metadata.file_type().is_symlink() {
        return Err(FusionError::InvalidPath);
    }
    let resolved = target
        .canonicalize()
        .map_err(|_| FusionError::InvalidPath)?;
    if resolved.starts_with(&base) {
        Ok(resolved)
    } else {
        Err(FusionError::InvalidPath)
    }
}

fn new_child(base: &Path, target: &Path) -> Result<PathBuf, FusionError> {
    let parent = target.parent().ok_or(FusionError::InvalidPath)?;
    let parent = existing_child(base, parent)?;
    let target = parent.join(target.file_name().ok_or(FusionError::InvalidPath)?);
    let relative = target
        .strip_prefix(base)
        .map_err(|_| FusionError::InvalidPath)?;
    let relative = relative.to_str().ok_or(FusionError::InvalidPath)?;
    let path = safe_join(base, relative)?;
    if path.exists() {
        return Err(FusionError::InvalidPath);
    }
    Ok(path)
}

fn copy_dir(
    from: &Path,
    to: &Path,
    source: &Path,
    destination_root: &Path,
) -> Result<(), FusionError> {
    for entry in std::fs::read_dir(from).map_err(|_| FusionError::PermissionDenied)? {
        let entry = entry.map_err(|_| FusionError::PermissionDenied)?;
        let path = entry.path();
        let metadata =
            std::fs::symlink_metadata(&path).map_err(|_| FusionError::PermissionDenied)?;
        let destination = to.join(entry.file_name());
        if metadata.file_type().is_symlink() {
            let link = std::fs::read_link(&path).map_err(|_| FusionError::PermissionDenied)?;
            let link = if link.is_absolute() {
                let resolved = link.canonicalize().unwrap_or(link.clone());
                resolved
                    .strip_prefix(source)
                    .map(|relative| destination_root.join(relative))
                    .unwrap_or(link)
            } else {
                link
            };
            std::os::unix::fs::symlink(link, &destination)
                .map_err(|_| FusionError::PermissionDenied)?;
        } else if metadata.file_type().is_dir() {
            std::fs::create_dir(&destination).map_err(|_| FusionError::PermissionDenied)?;
            copy_dir(&path, &destination, source, destination_root)?;
        } else if metadata.file_type().is_file() {
            std::fs::copy(&path, &destination).map_err(|_| FusionError::PermissionDenied)?;
        } else {
            return Err(FusionError::InvalidPath);
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::ids::new_id;

    fn test_dir(label: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!("fusioncross_{label}_{}", new_id()));
        std::fs::create_dir_all(&path).unwrap();
        path
    }

    #[test]
    fn rejects_escapes_and_relative_lookalikes() {
        let base = test_dir("paths");
        assert!(safe_join(&base, "bottle").is_ok());
        assert!(safe_join(&base, "../evil").is_err());
        assert!(safe_join(&base, "../../etc").is_err());
        assert!(safe_join(&base, "/etc/passwd").is_err());
        std::fs::remove_dir_all(base).ok();
    }

    #[test]
    fn is_inside_resolves_real_children_only() {
        let base = test_dir("inside");
        let child = base.join("bottle");
        std::fs::create_dir_all(&child).unwrap();
        assert!(is_inside(&base, &child));
        assert!(!is_inside(&base, Path::new("/tmp")));
        std::fs::remove_dir_all(base).ok();
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlink_escapes() {
        use std::os::unix::fs::symlink;

        let base = test_dir("symlink");
        let outside = test_dir("outside");
        symlink(&outside, base.join("escape")).unwrap();

        assert!(safe_join(&base, "escape/secret.txt").is_err());
        assert!(!is_inside(&base, &base.join("escape")));
        std::fs::remove_dir_all(base).ok();
        std::fs::remove_dir_all(outside).ok();
    }

    #[cfg(unix)]
    #[test]
    fn copy_preserves_wine_links_without_copying_host_content() {
        use std::os::unix::fs::symlink;

        let base = test_dir("copy");
        let source = base.join("source");
        let target = base.join("target");
        std::fs::create_dir_all(source.join("dosdevices")).unwrap();
        std::fs::create_dir_all(source.join("drive_c")).unwrap();
        std::fs::write(source.join("drive_c/app.exe"), b"app").unwrap();
        symlink("/", source.join("dosdevices/z:")).unwrap();
        symlink("../drive_c", source.join("dosdevices/c:")).unwrap();
        symlink(source.join("drive_c"), source.join("internal")).unwrap();

        safe_copy_all(&base, &source, &target).unwrap();
        assert_eq!(
            std::fs::read_link(target.join("dosdevices/z:")).unwrap(),
            Path::new("/")
        );
        assert_eq!(
            std::fs::read_link(target.join("dosdevices/c:")).unwrap(),
            Path::new("../drive_c")
        );
        assert_eq!(
            target.join("internal").canonicalize().unwrap(),
            target.join("drive_c").canonicalize().unwrap()
        );
        assert_eq!(
            std::fs::read(target.join("drive_c/app.exe")).unwrap(),
            b"app"
        );
        assert!(safe_file(&target, "dosdevices/z:/etc/passwd").is_err());
        assert!(safe_copy_all(&base, &source, &target).is_err());
        std::fs::remove_dir_all(base).ok();
    }
}
