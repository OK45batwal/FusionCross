use std::path::Path;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DiscoveredExe {
    /// Display name derived from the executable's file name
    pub name: String,
    /// Path relative to the prefix (e.g. "drive_c/Program Files/Foo/foo.exe")
    pub rel_path: String,
    /// Category hint for the library
    pub category: String,
}

const SKIP_TOP_DIRS: &[&str] = &[
    "windows",
    "ProgramData",
    "users",
    "perflogs",
    "dosdevices",
    "Common Files",
    "cef",
    "hardwareupdater",
    "Redist",
    "Engine",
    "DirectX",
    "_CommonRedist",
    "WindowsKits",
    "Windows Kits",
    "installers",
    "temp",
    "tmp",
    "downloads",
    "cache",
    "CrashReports",
    "Logs",
    "$Recycle.Bin",
];

const IGNORED_EXE_STEMS: &[&str] = &[
    // Uninstallers & setup helpers
    "uninstall",
    "unins000",
    "unins001",
    "setup",
    "installer",
    "install",
    "update",
    "updater",
    "patch",
    "patcher",
    "repair",
    // Crash and bug reporters
    "crashreporter",
    "crashpad_handler",
    "crashhandler",
    "steamerrorreporter",
    "steamerrorreporter64",
    "unitycrashhandler",
    "unitycrashhandler64",
    "unrealcefsubprocess",
    "cefprocess",
    "eacrashreporter",
    "blizzarderror",
    "writeminidump",
    "bugreport",
    // Steam & client internal helpers
    "steamwebhelper",
    "steamservice",
    "gameoverlayui",
    "gameoverlayui64",
    "steamxboxutil",
    "vulkandriverquery",
    "vulkandriverquery64",
    "gldriverquery",
    "gldriverquery64",
    "fossilize-replay",
    "fossilize-replay64",
    "secure_desktop_capture",
    "x86launcher",
    "x64launcher",
    // Runtime redists & installers
    "dxsetup",
    "dxwebsetup",
    "vcredist",
    "vcredist_x86",
    "vcredist_x64",
    "vc_redist",
    "vc_redist.x86",
    "vc_redist.x64",
    "dotNetFx",
    "dotnet",
    "msiexec",
    // System & console tools
    "winedbg",
    "wineboot",
    "winecfg",
    "regedit",
    "rundll32",
    "explorer",
    "control",
    "taskmgr",
    "cmd",
    "notepad",
    "winhlp32",
    "conhost",
    "svchost",
    "services",
    "easyanticheat_setup",
    "eac_setup",
    "battleye_setup",
    "dxdiag",
];

/// Find installable executables under a prefix's `drive_c`. Bounded recursion
/// (depth + entry budget) so the scan never blocks the machine (PRD §76).
pub fn scan_prefix(prefix: &Path) -> Vec<DiscoveredExe> {
    let drive_c = if prefix.join("drive_c").is_dir() {
        prefix.join("drive_c")
    } else {
        prefix.to_path_buf()
    };
    let mut out: Vec<DiscoveredExe> = Vec::new();
    let mut visited: std::collections::HashSet<std::path::PathBuf> = Default::default();
    let mut budget = 4000;
    collect(prefix, &drive_c, &mut out, &mut visited, 0, &mut budget);
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
        if path.is_symlink() {
            continue;
        }
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

        // Windows executables only
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase();
        if ext != "exe" {
            continue;
        }

        if is_ignored_exe(&path) {
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
        out.push(DiscoveredExe {
            name,
            rel_path: rel,
            category,
        });
    }
}

/// Strict filter for Windows applications: excludes installers, uninstallers,
/// crash handlers, patchers, intermediate runtime redists, and background helpers.
pub fn is_ignored_exe(path: &Path) -> bool {
    let path_str = path.to_string_lossy().to_ascii_lowercase();

    // Skip installers, temporary directories, caches, logs
    if path_str.contains("/installers/")
        || path_str.contains("/temp/")
        || path_str.contains("/tmp/")
        || path_str.contains("/appdata/local/temp/")
        || path_str.contains("/downloads/")
        || path_str.contains("/cache/")
        || path_str.contains("/crashreports/")
        || path_str.contains("/logs/")
        || path_str.contains("/$recycle.bin/")
    {
        return true;
    }

    let stem_lower = path
        .file_stem()
        .map(|s| s.to_string_lossy().to_ascii_lowercase())
        .unwrap_or_default();

    if stem_lower.is_empty() {
        return true;
    }

    if IGNORED_EXE_STEMS.iter().any(|s| stem_lower == *s)
        || stem_lower.starts_with("unins")
        || stem_lower.starts_with("setup")
        || stem_lower.ends_with("setup")
        || stem_lower.starts_with("install")
        || stem_lower.ends_with("installer")
        || stem_lower.starts_with("vc_redist")
        || stem_lower.starts_with("vcredist")
        || stem_lower.starts_with("dxsetup")
        || stem_lower.contains("crashreporter")
        || stem_lower.contains("crashhandler")
        || stem_lower.contains("unrealcefsubprocess")
        || stem_lower.contains("cefprocess")
        || stem_lower.contains("steamerrorreporter")
        || stem_lower.starts_with("patcher")
        || stem_lower.starts_with("updater")
        || stem_lower.ends_with("updater")
        || stem_lower.starts_with("autorun")
        || stem_lower.starts_with("eula")
    {
        return true;
    }

    // Ignore tiny stub binaries under 40 KB (typically crash forwarders or service stubs)
    if let Ok(meta) = std::fs::metadata(path) {
        if meta.len() < 40_000 {
            return true;
        }
    }

    false
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
    if p.contains("steam")
        || p.contains("epic")
        || p.contains("gog")
        || p.contains("battle.net")
        || p.contains("game")
    {
        "games".to_string()
    } else {
        "applications".to_string()
    }
}
