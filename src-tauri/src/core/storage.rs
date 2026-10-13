use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::Path;

use super::ids::new_id;
use super::state::{AppState, CURRENT_SCHEMA_VERSION};

/// Load metadata without ever replacing an unreadable or newer state with defaults.
pub fn load(path: &Path) -> io::Result<(AppState, Option<String>)> {
    let primary = match fs::read_to_string(path) {
        Ok(raw) => {
            let version = serde_json::from_str::<serde_json::Value>(&raw)
                .ok()
                .and_then(|v| v.get("schema_version").and_then(|v| v.as_u64()));
            if version.is_some_and(|v| v > u64::from(CURRENT_SCHEMA_VERSION)) {
                return Err(io::Error::other("State was saved by a newer FusionCross version. Update FusionCross to open it; your files have not been changed."));
            }
            if let Ok(state) = AppState::from_raw(&raw) {
                return Ok((state, None));
            }
            Some(raw)
        }
        Err(e) if e.kind() == io::ErrorKind::NotFound => None,
        Err(e) => return Err(e),
    };
    let backup = path.with_extension("json.bak");
    let raw = match fs::read_to_string(&backup) {
        Ok(raw) => raw,
        Err(e) if e.kind() == io::ErrorKind::NotFound && primary.is_none() => {
            return Ok((AppState::default(), None));
        }
        Err(_) => return Err(io::Error::other("Cannot read state.json and no readable backup is available. Your files have not been changed; restore state.json from a backup.")),
    };
    let state = AppState::from_raw(&raw).map_err(|_| io::Error::other(
        "Both state.json and its backup are invalid. Your files have not been changed; restore state.json from a backup."
    ))?;
    let notice = if let Some(original) = primary {
        let preserved = path.with_extension(format!("json.corrupt-{}", new_id()));
        atomic_write(&preserved, original.as_bytes())?;
        format!("Recovered your library from the previous saved state. Recent changes may be missing. The damaged state file is preserved at {}.", preserved.display())
    } else {
        "Recovered your library from its backup because state.json was missing. Recent changes may be missing.".into()
    };
    atomic_write(path, raw.as_bytes())?;
    Ok((state, Some(notice)))
}

/// Commit through a synced sibling file, keeping the previous valid version.
/// Callers serialize writes under the state mutex.
pub fn save(path: &Path, state: &AppState) -> io::Result<()> {
    let data = serde_json::to_vec_pretty(state)?;
    match fs::read_to_string(path) {
        Ok(previous) => {
            AppState::from_raw(&previous).map_err(io::Error::other)?;
            atomic_write(&path.with_extension("json.bak"), previous.as_bytes())?;
        }
        Err(e) if e.kind() == io::ErrorKind::NotFound => {}
        Err(e) => return Err(e),
    }
    atomic_write(path, &data)
}

fn atomic_write(path: &Path, data: &[u8]) -> io::Result<()> {
    use std::os::unix::fs::OpenOptionsExt;
    let parent = path
        .parent()
        .ok_or_else(|| io::Error::other("Missing state directory"))?;
    fs::create_dir_all(parent)?;
    let temporary = parent.join(format!(".state-{}.tmp", new_id()));
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(&temporary)?;
    let result = (|| {
        file.write_all(data)?;
        file.sync_all()?;
        fs::rename(&temporary, path)?;
        // Rename is the commit point. Report later directory-sync failures
        // without making callers roll back an already-published transaction.
        if let Err(error) = File::open(parent).and_then(|directory| directory.sync_all()) {
            eprintln!("State committed, but syncing its directory failed: {error}");
        }
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recovers_previous_save_and_preserves_corrupt_file() {
        let dir = std::env::temp_dir().join(format!("fc_state_{}", new_id()));
        let path = dir.join("state.json");
        let mut state = AppState::default();
        save(&path, &state).unwrap();
        state.settings.push(("test".into(), "new".into()));
        save(&path, &state).unwrap();
        fs::write(&path, "broken").unwrap();
        let (recovered, notice) = load(&path).unwrap();
        assert_eq!(recovered.settings.len(), 1);
        assert!(notice.unwrap().contains("Recovered"));
        assert!(fs::read_dir(&dir).unwrap().flatten().any(|e| e
            .file_name()
            .to_string_lossy()
            .starts_with("state.json.corrupt-")));
        assert!(AppState::from_raw(&fs::read_to_string(&path).unwrap()).is_ok());
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn never_overwrites_newer_or_unrecoverable_state() {
        let dir = std::env::temp_dir().join(format!("fc_state_{}", new_id()));
        let path = dir.join("state.json");
        save(&path, &AppState::default()).unwrap();
        save(&path, &AppState::default()).unwrap();
        let future = r#"{"schema_version":4294967296}"#;
        fs::write(&path, future).unwrap();
        assert!(load(&path).is_err());
        assert_eq!(fs::read_to_string(&path).unwrap(), future);
        fs::remove_file(path.with_extension("json.bak")).unwrap();
        fs::write(&path, "broken").unwrap();
        assert!(load(&path).is_err());
        assert!(save(&path, &AppState::default()).is_err());
        assert_eq!(fs::read_to_string(&path).unwrap(), "broken");
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn missing_primary_uses_backup() {
        let dir = std::env::temp_dir().join(format!("fc_state_{}", new_id()));
        let path = dir.join("state.json");
        save(&path, &AppState::default()).unwrap();
        save(&path, &AppState::default()).unwrap();
        fs::remove_file(&path).unwrap();
        assert!(load(&path).unwrap().1.is_some());
        fs::remove_dir_all(dir).unwrap();
    }
}
