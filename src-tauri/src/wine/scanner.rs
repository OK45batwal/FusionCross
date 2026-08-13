use std::path::Path;

use crate::core::errors::FusionError;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DiscoveredExe {
    /// Display name derived from the executable's file name
    pub name: String,
    /// Path relative to the prefix (e.g. "drive_c/Program Files/Foo/foo.exe")
    pub rel_path: String,
    /// Category hint for the library
    pub category: String,
}

const SKIP_TOP_DIRS: [&str; 6] = [
    "windows", "ProgramData", "users", "perflogs", "Program Files (x86)/WindowsKits", "Windows Kits",
];

/// Find installable executables under a prefix's `drive_c`. Bounded recursion
/// (depth + entry budget) so the scan never blocks the machine (PRD §76).
pub fn scan_prefix(prefix: &Path) -> Vec<DiscoveredExe> {
    let mut out: Vec<DiscoveredExe> = Vec::new();
    let mut visited: std::collections::HashSet<std::path::PathBuf> = Default::default();
    let mut budget = 4000;
    collect(prefix, prefix, &mut out, &mut visited, 0, &mut budget);
    out
}

fn collect(
    base: &Path,
    dir: &Path,
    out: &mut Vec<DiscoveredExe>,
    visited: &mut std::collections::HashSet<std::path::PathBuf>,
    depth: usize,
    budget: &mut usize,
) {
    if depth > 10 || *budget == 0 {
        return;
    }
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if SKIP_TOP_DIRS.iter().any(|s| name.eq_ignore_ascii_case(s)) {
                    continue;
                }
                if !visited.insert(path.clone()) {
                    continue;
                }
            }
            collect(base, &path, out, visited, depth + 1, budget);
            continue;
        }
        // MSI installers and Windows executables
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase();
        if ext != "exe" && ext != "msi" {
            continue;
        }
        *budget -= 1;
        let rel = path
            .strip_prefix(base)
            .unwrap_or(&path)
            .to_string_lossy()
            .into_owned();
        let name = path
            .file_stem()
            .map(|s| prettify(&s.to_string_lossy()))
            .unwrap_or_else(|| "Unknown".into());
        let category = guess_category(&path);
        out.push(DiscoveredExe { name, rel_path: rel, category });
    }
}

fn prettify(stem: &str) -> String {
    stem.replace(['_', '.', '-'], " ")
        .split_whitespace()
        .map(|w| {
            let mut c = w.chars();
            match c.next() {
                Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn guess_category(path: &Path) -> String {
    let p = path.to_string_lossy().to_lowercase();
    if p.contains("steam") || p.contains("epic") || p.contains("gog") || p.contains("battle.net") {
        "games".to_string()
    } else {
        "applications".to_string()
    }
}