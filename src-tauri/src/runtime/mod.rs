use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::core::errors::FusionError;
use crate::security::archives;
use crate::wine::engine::parse_wine_version;

#[derive(Debug, Clone, Serialize)]
pub struct RuntimeStatus {
    pub name: String,
    pub version: String,
}

/// A known remote runtime (PRD §31). `sha256` pinned per release; empty means
/// "not publishable yet" — downloads of it are refused until a checksum exists.
#[derive(Debug, Clone, Serialize)]
#[allow(dead_code)]
pub struct CatalogEntry {
    pub id: String,
    pub name: String,
    pub category: &'static str,
    pub version: &'static str,
    pub url: &'static str,
    pub sha256: &'static str,
    pub note: &'static str,
}

#[allow(dead_code)]
pub fn catalog() -> Vec<CatalogEntry> {
    vec![
        CatalogEntry {
            id: "wine-stable".into(),
            name: "Wine Stable".into(),
            category: "wine",
            version: "9.0",
            url: "https://dl.winehq.org/wine/source/9.0/wine-9.0.tar.xz",
            sha256: "",
            note: "Source tarball; prefers a packaged build (brew).",
        },
        CatalogEntry {
            id: "wine-ge".into(),
            name: "Wine-GE".into(),
            category: "wine",
            version: "custom",
            url: "https://github.com/GloriousEggroll/wine-ge-custom/releases",
            sha256: "",
            note: "Custom Wine built for games. Import a release archive in the app.",
        },
        CatalogEntry {
            id: "proton-ge".into(),
            name: "Proton-GE".into(),
            category: "proton",
            version: "custom",
            url: "https://github.com/GloriousEggroll/proton-ge-custom/releases",
            sha256: "",
            note: "STEAM_COMPAT based runtime. Import a release archive in the app.",
        },
    ]
}

/// Locate the wine binary inside an extracted runtime.
pub fn engine_binary(runtime_path: &Path) -> Option<PathBuf> {
    for cand in ["bin/wine64", "bin/wine", "wine64", "wine"] {
        let p = runtime_path.join(cand);
        if p.exists() {
            return Some(p);
        }
    }
    None
}

/// Probe a runtime's version string from its `--version` output.
pub fn probe_runtime_version(runtime_path: &Path) -> Result<String, FusionError> {
    let bin = engine_binary(runtime_path).ok_or(FusionError::RuntimeNotFound)?;
    let out = std::process::Command::new(bin)
        .arg("--version")
        .output()
        .map_err(|_| FusionError::RuntimeNotFound)?;
    let stdout = String::from_utf8_lossy(&out.stdout).into_owned();
    parse_wine_version(&stdout).ok_or(FusionError::RuntimeNotFound)
}

/// Sanity-check an extracted runtime before registering (PRD §55).
#[allow(dead_code)]
pub fn validate_runtime(runtime_path: &Path) -> Result<(), FusionError> {
    probe_runtime_version(runtime_path).map(|_| ())
}

/// Download a remote runtime, verify its SHA-256 then extract it. Uses curl only.
#[allow(dead_code)]
pub fn download_runtime(
    url: &str,
    sha256: &str,
    dest_pkg: &Path,
    dest_dir: &Path,
) -> Result<(), FusionError> {
    if url.is_empty() || sha256.is_empty() {
        return Err(FusionError::RuntimeVerificationFailed);
    }
    let out = std::process::Command::new("curl")
        .args(["-fL", "--max-time", "3600", "-o"])
        .arg(dest_pkg)
        .arg(url)
        .status()
        .map_err(|_| FusionError::RuntimeVerificationFailed)?;
    if !out.success() {
        return Err(FusionError::RuntimeVerificationFailed);
    }
    archives::verify_sha256(dest_pkg, sha256)?;
    archives::extract_archive(dest_pkg, dest_dir)?;
    std::fs::remove_file(dest_pkg).ok();
    Ok(())
}

/// Install a runtime from an already-sourced archive (download cache or user
/// import). Validates + extracts + probes, returns its resolved version.
pub fn install_from_archive(
    archive: &Path,
    dest_dir: &Path,
) -> Result<String, FusionError> {
    if archives::detect_kind(archive).is_none() {
        return Err(FusionError::ArchiveValidationFailed);
    }
    archives::extract_archive(archive, dest_dir)?;
    match probe_runtime_version(dest_dir) {
        Ok(ver) => Ok(ver),
        Err(_) => {
            let _ = std::fs::remove_dir_all(dest_dir);
            Err(FusionError::RuntimeVerificationFailed)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::ids::new_id;

    #[test]
    fn catalog_entries_are_named() {
        let entries = catalog();
        assert_eq!(entries.len(), 3);
        assert!(entries.iter().all(|e| !e.id.is_empty() && !e.name.is_empty()));
    }

    #[test]
    fn import_from_tar_archive_works() {
        let dir = std::env::temp_dir().join(format!("fc_rt_{}", new_id()));
        let archive = dir.join("rt.tar.gz");
        let out = dir.join("out");
        std::fs::create_dir_all(&dir).unwrap();

        {
            let enc =
                flate2::write::GzEncoder::new(std::fs::File::create(&archive).unwrap(), flate2::Compression::default());
            let mut b = tar::Builder::new(enc);
            let script = b"#!/bin/sh\necho 'wine-9.0 (FusionCross)'\n".as_ref();
            let mut h = tar::Header::new_gnu();
            h.set_size(script.len() as u64);
            h.set_mode(0o755);
            h.set_cksum();
            b.append_data(&mut h, "bin/wine", &mut std::io::Cursor::new(script)).unwrap();
            b.finish().unwrap();
        }

        let version = install_from_archive(&archive, &out).unwrap();
        assert_eq!(version, "9.0");
        std::fs::remove_dir_all(&dir).ok();
    }
}