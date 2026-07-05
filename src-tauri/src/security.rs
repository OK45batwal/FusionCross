// ========================================================
// PATH SECURITY, SANITIZATION & INPUT VALIDATION
// ========================================================

use std::fs;
use std::path::{Component, Path, PathBuf};
use std::process::Command;

use crate::state::{get_fusioncross_base_dir, user_home_dir};

pub const MAX_ID_LENGTH: usize = 128;
pub const MAX_DISPLAY_NAME_LENGTH: usize = 128;
pub const MAX_EXECUTABLE_PATH_LEN: usize = 1024;
pub const MAX_INSTALLER_PATH_LEN: usize = 4096;

/// Validates that a given path resolves within the allowed FusionCross base directory.
/// Prevents path traversal attacks (e.g., ../../etc/passwd).
pub fn validate_sandbox_path(target: &Path) -> Result<PathBuf, String> {
  let base = get_fusioncross_base_dir();

  // Ensure the base directory exists
  if !base.exists() {
    let _ = fs::create_dir_all(&base);
  }

  let canonical_base = fs::canonicalize(&base).unwrap_or_else(|_| base.clone());

  // Resolve the target path relative to base
  let resolved = if target.is_absolute() {
    target.to_path_buf()
  } else {
    base.join(target)
  };

  // If the target doesn't exist yet, verify its parent chain
  let check_path = if resolved.exists() {
    fs::canonicalize(&resolved).map_err(|e| format!("Path resolution failed: {}", e))?
  } else {
    // Walk up to find the closest existing ancestor
    let mut ancestor = resolved.clone();
    while !ancestor.exists() {
      if let Some(parent) = ancestor.parent() {
        ancestor = parent.to_path_buf();
      } else {
        return Err("Invalid path: no existing ancestor".to_string());
      }
    }
    let canonical_ancestor = fs::canonicalize(&ancestor)
      .map_err(|e| format!("Ancestor path resolution failed: {}", e))?;
    // Re-append the remaining suffix
    let suffix = resolved.strip_prefix(&ancestor).unwrap_or(Path::new(""));
    canonical_ancestor.join(suffix)
  };

  if check_path.starts_with(&canonical_base) {
    Ok(resolved)
  } else {
    Err(format!(
      "Security Traversal: path '{}' escapes the FusionCross sandbox directory '{}'",
      resolved.display(),
      base.display()
    ))
  }
}

/// Strictly validates alphanumeric names for identifiers like bottle_id and runtime_id
pub fn validate_id(id: &str) -> Result<(), String> {
  if !id.is_empty()
    && id.len() <= MAX_ID_LENGTH
    && id.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_')
  {
    Ok(())
  } else {
    Err(format!("Security: Invalid ID parameter '{}' contains forbidden characters.", id))
  }
}

pub fn validate_display_name(name: &str) -> Result<(), String> {
  if name.is_empty() || name.len() > MAX_DISPLAY_NAME_LENGTH {
    return Err(format!("Name must be between 1 and {} characters.", MAX_DISPLAY_NAME_LENGTH));
  }
  if name
    .chars()
    .all(|c| {
      c.is_alphanumeric()
        || matches!(c, ' ' | '-' | '_' | '.' | '+' | '&' | '(' | ')' | '\'' | ':')
    })
  {
    Ok(())
  } else {
    Err(format!("Security: Invalid name '{}'.", name))
  }
}

pub fn validate_command_text(value: &str, field_name: &str, max_len: usize) -> Result<(), String> {
  if value.len() > max_len {
    return Err(format!("{} is too long.", field_name));
  }
  if value.chars().any(|c| c.is_control() && c != '\n' && c != '\t') {
    return Err(format!("{} contains invalid control characters.", field_name));
  }
  Ok(())
}

pub fn validate_executable_path(path: &str) -> Result<(), String> {
  validate_command_text(path, "Executable path", MAX_EXECUTABLE_PATH_LEN)?;
  if path.trim().is_empty() {
    return Err("Executable path is required.".to_string());
  }
  Ok(())
}

pub fn validate_prefix_type(prefix_type: &str) -> Result<(), String> {
  const ALLOWED: &[&str] = &[
    "gaming",
    "productivity",
    "legacy",
    "dxvk-optimized",
    "lightweight",
  ];
  if ALLOWED.contains(&prefix_type) {
    Ok(())
  } else {
    Err(format!("Unknown prefix type '{}'.", prefix_type))
  }
}

pub fn validate_host_installer_path(path: &str) -> Result<PathBuf, String> {
  let candidate = PathBuf::from(path.trim());
  if !candidate.is_absolute() {
    return Err("Installer path must be absolute.".to_string());
  }
  if !candidate.exists() {
    return Err(format!("Installer not found: {}", candidate.display()));
  }

  let home = user_home_dir()?;
  let allowed_prefixes = [
    home.clone(),
    PathBuf::from("/Applications"),
    PathBuf::from("/opt"),
    PathBuf::from("/usr"),
    PathBuf::from("/Volumes"),
  ];

  if allowed_prefixes
    .iter()
    .any(|prefix| candidate.starts_with(prefix))
  {
    Ok(candidate)
  } else {
    Err("Installer must be located under your home folder or standard system paths.".to_string())
  }
}

pub fn is_path_under_home(path: &str) -> bool {
  let Ok(home) = user_home_dir() else {
    return false;
  };

  let candidate = Path::new(path);
  if candidate.is_absolute() {
    candidate.starts_with(&home)
  } else {
    false
  }
}

/// Enforces URL origin restrictions restricting runtime engine archive downloads to secure paths only
pub fn validate_download_url(url: &str) -> Result<(), String> {
  let lowercase_url = url.to_lowercase();
  if lowercase_url.starts_with("https://github.com/")
     || lowercase_url.starts_with("https://dl.winehq.org/")
     || lowercase_url.starts_with("https://khronos.org/")
  {
    Ok(())
  } else {
    Err(format!("Security: Untrusted download source URL origin '{}'. Download rejected.", url))
  }
}

pub fn validate_tar_entry_name(entry: &str) -> Result<(), String> {
  let trimmed = entry.trim();
  if trimmed.is_empty() || trimmed.starts_with('/') || trimmed.starts_with('\\') {
    return Err(format!("Archive contains unsafe entry '{}'.", entry));
  }

  let path = Path::new(trimmed);
  if path.is_absolute()
    || path
      .components()
      .any(|component| matches!(component, Component::ParentDir | Component::Prefix(_)))
  {
    return Err(format!("Archive contains unsafe entry '{}'.", entry));
  }

  Ok(())
}

pub fn validate_tar_archive_for_safe_extract(archive_path: &Path) -> Result<(), String> {
  let table_output = Command::new("tar")
    .args(["-tvzf"])
    .arg(archive_path)
    .output()
    .map_err(|e| format!("Failed to inspect archive metadata: {}", e))?;

  if !table_output.status.success() {
    return Err(format!(
      "Archive metadata inspection failed: {}",
      String::from_utf8_lossy(&table_output.stderr)
    ));
  }

  for line in String::from_utf8_lossy(&table_output.stdout).lines() {
    let kind = line.chars().next().unwrap_or('-');
    if matches!(kind, 'l' | 'h') {
      return Err("Archive contains links, which are not allowed for runtime installs.".to_string());
    }
  }

  let list_output = Command::new("tar")
    .args(["-tzf"])
    .arg(archive_path)
    .output()
    .map_err(|e| format!("Failed to inspect archive paths: {}", e))?;

  if !list_output.status.success() {
    return Err(format!(
      "Archive path inspection failed: {}",
      String::from_utf8_lossy(&list_output.stderr)
    ));
  }

  for entry in String::from_utf8_lossy(&list_output.stdout).lines() {
    validate_tar_entry_name(entry)?;
  }

  Ok(())
}

/// Escape a string for use inside an AppleScript double-quoted string literal.
pub fn applescript_string(value: &str) -> String {
  format!(
    "\"{}\"",
    value
      .replace('\\', "\\\\")
      .replace('"', "\\\"")
      .replace('\n', " ")
      .replace('\r', " ")
  )
}
