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
    let rt = st
        .0
        .lock()
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

    // Check custom path in settings
    if let Ok(state) = st.0.lock() {
        if let Some((_, custom_path)) = state.settings.iter().find(|(k, _)| k == "wine_binary_path")
        {
            if !custom_path.is_empty() && Path::new(custom_path).exists() {
                return Ok(custom_path.clone());
            }
        }
    }

    // Check user Library Whisky installation
    if let Ok(home) = std::env::var("HOME").map(PathBuf::from) {
        let whisky_bin = home
            .join("Library/Application Support/com.isaacmarovitz.Whisky/Libraries/Wine/bin/wine64");
        if whisky_bin.exists() {
            return Ok(whisky_bin.to_string_lossy().into_owned());
        }
        let fc_runtime_bin =
            home.join("Library/Application Support/FusionCross/runtimes/whisky-wine/bin/wine64");
        if fc_runtime_bin.exists() {
            return Ok(fc_runtime_bin.to_string_lossy().into_owned());
        }
    }

    // Standard macOS locations (Homebrew, CrossOver, Whisky)
    let candidates = [
        "/opt/homebrew/bin/wine64",
        "/opt/homebrew/bin/wine",
        "/usr/local/bin/wine64",
        "/usr/local/bin/wine",
        "/Applications/CrossOver.app/Contents/SharedSupport/CrossOver/bin/wine64",
        "/Applications/CrossOver.app/Contents/SharedSupport/CrossOver/bin/wine",
        "/Applications/Whisky.app/Contents/Resources/Wine/bin/wine64",
    ];

    for cand in candidates {
        if Path::new(cand).exists() {
            return Ok(cand.to_string());
        }
    }

    // Check PATH via which
    if let Ok(out) = std::process::Command::new("which").arg("wine64").output() {
        if out.status.success() {
            let p = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !p.is_empty() && Path::new(&p).exists() {
                return Ok(p);
            }
        }
    }
    if let Ok(out) = std::process::Command::new("which").arg("wine").output() {
        if out.status.success() {
            let p = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !p.is_empty() && Path::new(&p).exists() {
                return Ok(p);
            }
        }
    }

    Err(FusionError::RuntimeNotFound)
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
            env.push(("DYLD_FALLBACK_LIBRARY_PATH".into(), joined.clone()));
            env.push(("DYLD_LIBRARY_PATH".into(), joined));
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
        env.push((
            "DXVK_HUD".into(),
            "compiler,fps,frametimes,gpuload".into(),
        ));
    } else {
        env.push(("MTL_HUD_ENABLED".into(), "0".into()));
        env.push(("DXVK_HUD".into(), "0".into()));
    }

    // 6. Graphics Backend Routing & Overrides
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
}
