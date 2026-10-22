#![allow(dead_code)]

use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

use crate::core::errors::FusionError;
use crate::manager::FusionState;
use crate::runtime;

pub mod applications;
pub mod bottles;
pub mod catalog;
pub mod diagnostics;
pub mod installers;
pub mod runtimes;
pub mod settings;
pub mod snapshots;
mod validation;

// Re-export all commands for direct use in Tauri handler and external callers
pub use applications::*;
pub use bottles::*;
pub use catalog::*;
pub use diagnostics::*;
pub use installers::*;
pub use runtimes::*;
pub use settings::*;
pub use snapshots::*;

pub fn now_ts() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_default()
}

pub fn wine_binary_for(app: &AppHandle, runtime_id: &str) -> Result<String, FusionError> {
    let st = app.state::<FusionState>();
    let rt =
        st.0.lock()
            .map_err(|_| FusionError::Unsupported)?
            .runtimes
            .iter()
            .find(|r| r.id == runtime_id)
            .cloned();

    if let Some(r) = rt {
        if let Some(bin) = runtime::engine_binary(Path::new(&r.path)) {
            return Ok(bin.to_string_lossy().into_owned());
        }
    }

    detected_wine_path(app).ok_or(FusionError::RuntimeNotFound)
}

/// Any usable Wine binary: the configured one, an imported runtime, or one
/// already installed on the Mac. `None` means Windows apps cannot launch yet.
pub fn detected_wine_path(app: &AppHandle) -> Option<String> {
    let st = app.state::<FusionState>();
    if let Ok(state) = st.0.lock() {
        if let Some((_, custom_path)) = state.settings.iter().find(|(k, _)| k == "wine_binary_path")
        {
            if !custom_path.is_empty() && Path::new(custom_path).exists() {
                return Some(custom_path.clone());
            }
        }
        for runtime in &state.runtimes {
            if let Some(bin) = runtime::engine_binary(Path::new(&runtime.path)) {
                return Some(bin.to_string_lossy().into_owned());
            }
        }
    }
    auto_detect_wine()
}

fn auto_detect_wine() -> Option<String> {
    let home = std::env::var_os("HOME").map(PathBuf::from)?;
    let candidates = [
        // Whisky downloads its Wine toolkit outside the app bundle.
        home.join("Library/Application Support/com.isaacmarovitz.Whisky/Libraries/Wine/bin/wine64"),
        home.join("Library/Application Support/FusionCross/runtimes/whisky-wine/bin/wine64"),
        PathBuf::from("/opt/homebrew/bin/wine64"),
        PathBuf::from("/opt/homebrew/bin/wine"),
        PathBuf::from("/usr/local/bin/wine64"),
        PathBuf::from("/usr/local/bin/wine"),
        PathBuf::from("/Applications/CrossOver.app/Contents/SharedSupport/CrossOver/bin/wine64"),
        PathBuf::from("/Applications/CrossOver.app/Contents/SharedSupport/CrossOver/bin/wine"),
        PathBuf::from("/Applications/Whisky.app/Contents/Resources/Wine/bin/wine64"),
    ];
    for candidate in candidates {
        if candidate.exists() {
            return Some(candidate.to_string_lossy().into_owned());
        }
    }

    // Packaged builds (Homebrew casks, Gcenx) land as `Wine <flavour>.app`
    // with the binary under Contents/Resources/wine/bin.
    for root in [PathBuf::from("/Applications"), home.join("Applications")] {
        if let Some(found) = wine_in_app_bundles(&root) {
            return Some(found);
        }
    }

    for tool in ["wine64", "wine"] {
        if let Ok(out) = std::process::Command::new("which").arg(tool).output() {
            if out.status.success() {
                let path = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if !path.is_empty() && Path::new(&path).exists() {
                    return Some(path);
                }
            }
        }
    }
    None
}

fn wine_in_app_bundles(root: &Path) -> Option<String> {
    for entry in std::fs::read_dir(root).ok()?.flatten() {
        let name = entry.file_name().to_string_lossy().to_ascii_lowercase();
        if !name.ends_with(".app") || !name.contains("wine") {
            continue;
        }
        for relative in [
            "Contents/Resources/wine/bin/wine64",
            "Contents/Resources/wine/bin/wine",
        ] {
            let candidate = entry.path().join(relative);
            if candidate.exists() {
                return Some(candidate.to_string_lossy().into_owned());
            }
        }
    }
    None
}

pub fn settings_bool(app: &AppHandle, key: &str) -> bool {
    app.state::<FusionState>()
        .0
        .lock()
        .ok()
        .and_then(|g| {
            g.settings
                .iter()
                .find(|(k, _)| k == key)
                .map(|(_, v)| v == "on")
        })
        .unwrap_or(false)
}

/// Construct the complete Wine execution context (environment variables and DLL overrides)
/// ensuring full support for Apple D3DMetal (GPTK), DXVK, Rosetta 2 AVX, and Mach semaphores.
pub fn build_wine_execution_context(
    wine_binary: &str,
    bottle: &crate::core::state::Bottle,
    safe_mode: bool,
) -> (Vec<(String, String)>, String) {
    let mut env = bottle.environment.clone();
    // Older state files may still contain this reserved override.
    env.retain(|(key, _)| key != "WINEPREFIX");

    // 1. Resolve Wine runtime root directory
    let bin_path = Path::new(wine_binary);
    let runtime_dir = bin_path.parent().and_then(|p| p.parent());

    // 2. Dynamic Linker library paths for D3DMetal and Wine dylibs
    if let Some(rdir) = runtime_dir {
        let ext_dir = rdir.join("lib").join("external");
        let lib_dir = rdir.join("lib");
        let mut dyld_paths = Vec::new();
        if ext_dir.exists() {
            dyld_paths.push(ext_dir.to_string_lossy().into_owned());
        }
        if lib_dir.exists() {
            dyld_paths.push(lib_dir.to_string_lossy().into_owned());
        }

        if !dyld_paths.is_empty() {
            let joined = dyld_paths.join(":");
            // Never set DYLD_LIBRARY_PATH: it overrides dyld for the Wine
            // preloader and makes Chromium's CEF helper fail to register its
            // message window, leaving Steam with no UI. The fallback path is
            // enough for D3DMetal's dylibs.
            env.push(("DYLD_FALLBACK_LIBRARY_PATH".into(), joined));
        }

        if ext_dir.join("D3DMetal.framework").exists() {
            let ext_str = ext_dir.to_string_lossy().into_owned();
            env.push(("DYLD_FRAMEWORK_PATH".into(), ext_str.clone()));
            env.push(("DYLD_FALLBACK_FRAMEWORK_PATH".into(), ext_str));
        }

        if let Some(bin_dir) = bin_path.parent() {
            let current_path = std::env::var("PATH").unwrap_or_default();
            env.push((
                "PATH".into(),
                format!("{}:{}", bin_dir.to_string_lossy(), current_path),
            ));
        }
    }

    // 3. Apple Silicon Rosetta 2 AVX & DXR Advertisement
    if std::env::consts::ARCH == "aarch64" {
        env.push(("ROSETTA_ADVERTISE_AVX".into(), "1".into()));
        env.push(("D3DM_SUPPORT_DXR".into(), "1".into()));
    }

    // 4. Synchronization (MSync / Mach Semaphores)
    if bottle.msync_enabled {
        env.push(("WINEMSYNC".into(), "1".into()));
        env.push(("WINE_MSYNC".into(), "1".into()));
        env.push(("WINEESYNC".into(), "0".into()));
        env.push(("WINEFSYNC".into(), "0".into()));
    } else {
        env.push(("WINEMSYNC".into(), "0".into()));
        env.push(("WINE_MSYNC".into(), "0".into()));
    }

    // 5. Diagnostics HUD
    if bottle.performance_hud && !safe_mode {
        env.push(("MTL_HUD_ENABLED".into(), "1".into()));
        env.push(("DXVK_HUD".into(), "compiler,fps,frametimes,gpuload".into()));
    } else {
        env.push(("MTL_HUD_ENABLED".into(), "0".into()));
        env.push(("DXVK_HUD".into(), "0".into()));
    }

    // 6. Suppress noisy Wine fixme stubs
    if !env.iter().any(|(k, _)| k == "WINEDEBUG") {
        env.push(("WINEDEBUG".into(), "fixme-all".into()));
    }

    // 7. Graphics Backend Routing & Overrides
    let mut overrides = bottle.dll_overrides.clone();
    overrides.push("mscoree,mshtml=".into()); // Silence gecko/mono prompts

    match bottle.graphics.as_str() {
        "d3dmetal" => {
            // GPTK / D3DMetal provides native d3d11, d3d12, dxgi, d3d10core on Metal
            overrides.push("d3d11,d3d12,dxgi,d3d10core=n,b".into());
            env.push(("WINE_D3D_CONFIG".into(), "renderer=metal".into()));
        }
        "dxvk" => {
            // DXVK translates DirectX 9, 10, 11 to Vulkan (MoltenVK on macOS)
            overrides.push("d3d11,d3d10core,dxgi,d3d9=n,b".into());
            env.push(("DXVK_ASYNC".into(), "1".into()));
        }
        _ => {
            // Pure Wine builtin OpenGL
            overrides.push("d3d11,d3d12,dxgi=b".into());
        }
    }

    (env, overrides.join(";"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::state::Bottle;

    #[test]
    fn test_build_wine_execution_context_d3dmetal() {
        let b = Bottle {
            id: "b1".into(),
            name: "Gaming Bottle".into(),
            prefix_type: "gaming".into(),
            runtime: "whisky-wine".into(),
            windows_version: "win10".into(),
            graphics: "d3dmetal".into(),
            dxvk_enabled: true,
            msync_enabled: true,
            performance_hud: true,
            retina_mode: false,
            path: "/tmp/prefix".into(),
            created_at: "".into(),
            last_used_at: None,
            environment: vec![("CUSTOM_KEY".into(), "CUSTOM_VAL".into())],
            dll_overrides: vec!["custom_dll=n".into()],
            dependencies: vec![],
        };

        let (env, overrides) = build_wine_execution_context("/fake/runtime/bin/wine64", &b, false);

        assert!(overrides.contains("d3d11,d3d12,dxgi,d3d10core=n,b"));
        assert!(overrides.contains("custom_dll=n"));
        assert!(overrides.contains("mscoree,mshtml="));

        let env_map: std::collections::HashMap<_, _> = env.into_iter().collect();
        assert_eq!(env_map.get("CUSTOM_KEY"), Some(&"CUSTOM_VAL".to_string()));
        assert_eq!(env_map.get("WINEMSYNC"), Some(&"1".to_string()));
        assert_eq!(env_map.get("MTL_HUD_ENABLED"), Some(&"1".to_string()));
        if std::env::consts::ARCH == "aarch64" {
            assert_eq!(env_map.get("ROSETTA_ADVERTISE_AVX"), Some(&"1".to_string()));
        }
    }

    #[test]
    fn never_sets_dyld_library_path_for_wine() {
        let root = std::env::temp_dir().join(format!("fc_dyld_{}", crate::core::ids::new_id()));
        std::fs::create_dir_all(root.join("lib/external")).unwrap();
        let bottle: Bottle = serde_json::from_value(serde_json::json!({
            "id": "b", "name": "Bottle", "path": "/tmp/prefix"
        }))
        .unwrap();
        let wine = root.join("bin/wine64");

        let (env, _) = build_wine_execution_context(&wine.to_string_lossy(), &bottle, true);
        let keys: Vec<&str> = env.iter().map(|(k, _)| k.as_str()).collect();
        assert!(!keys.contains(&"DYLD_LIBRARY_PATH"));
        assert!(keys.contains(&"DYLD_FALLBACK_LIBRARY_PATH"));

        std::fs::remove_dir_all(root).ok();
    }

    #[test]
    fn finds_wine_inside_a_cask_app_bundle() {
        let root = std::env::temp_dir().join(format!("fc_apps_{}", crate::core::ids::new_id()));
        let bin = root.join("Wine Stable.app/Contents/Resources/wine/bin");
        std::fs::create_dir_all(&bin).unwrap();
        std::fs::write(bin.join("wine64"), b"stub").unwrap();
        std::fs::create_dir_all(root.join("Unrelated.app/Contents/Resources")).unwrap();

        let found = wine_in_app_bundles(&root).expect("wine inside the app bundle");
        assert!(found.ends_with("Wine Stable.app/Contents/Resources/wine/bin/wine64"));

        std::fs::remove_dir_all(root).ok();
    }
}
