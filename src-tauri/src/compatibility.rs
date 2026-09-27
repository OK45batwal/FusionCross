use serde::Serialize;

/// Compatibility profiles (PRD §34–35). A small locally-learned database now;
/// the community compatibility database will feed the same shape later.
#[derive(Debug, Clone, Serialize)]
pub struct Recommendation {
    pub profile: &'static str,
    pub runtime_hint: &'static str,
    pub graphics: &'static str,
    pub windows_version: &'static str,
    pub dependencies: Vec<&'static str>,
    pub launch_arguments: Vec<String>,
    pub compatibility: u32,
    pub notes: Vec<&'static str>,
}

struct Profile {
    key: &'static str,
    runtime_hint: &'static str,
    graphics: &'static str,
    windows_version: &'static str,
    dependencies: Vec<&'static str>,
    launch_arguments: Vec<String>,
    compatibility: u32,
    notes: Vec<&'static str>,
}

fn profiles() -> Vec<Profile> {
    vec![
        Profile {
            key: "cyberpunk",
            runtime_hint: "Wine-GE",
            graphics: "d3dmetal",
            windows_version: "win10",
            dependencies: vec!["vcrun2022", "d3dcompiler_47"],
            launch_arguments: vec!["-skipStartScreen".into()],
            compatibility: 86,
            notes: vec!["D3DMetal and MSync provide best frame rates on M-series chips."],
        },
        Profile {
            key: "elden",
            runtime_hint: "Wine-GE",
            graphics: "d3dmetal",
            windows_version: "win10",
            dependencies: vec!["vcrun2022"],
            launch_arguments: vec![],
            compatibility: 85,
            notes: vec!["EAC requires offline mode or anti-cheat toggle to start in Wine."],
        },
        Profile {
            key: "baldur",
            runtime_hint: "Wine Stable",
            graphics: "d3dmetal",
            windows_version: "win11",
            dependencies: vec!["vcrun2019", "corefonts"],
            launch_arguments: vec![],
            compatibility: 92,
            notes: vec!["Select DX11 mode in Larian launcher for highest stability."],
        },
        Profile {
            key: "gta",
            runtime_hint: "Wine Stable",
            graphics: "dxvk",
            windows_version: "win10",
            dependencies: vec!["vcrun2019", "d3dcompiler_47"],
            launch_arguments: vec![],
            compatibility: 89,
            notes: vec!["Story mode runs smoothly with DXVK and MSync."],
        },
        Profile {
            key: "witcher",
            runtime_hint: "Wine Stable",
            graphics: "d3dmetal",
            windows_version: "win10",
            dependencies: vec!["vcrun2019"],
            launch_arguments: vec![],
            compatibility: 90,
            notes: vec!["DirectX 11 mode recommended for best FPS."],
        },
        Profile {
            key: "skyrim",
            runtime_hint: "Wine Stable",
            graphics: "dxvk",
            windows_version: "win10",
            dependencies: vec!["vcrun2019"],
            launch_arguments: vec![],
            compatibility: 94,
            notes: vec!["Flawless performance with DXVK. Mod organizer works."],
        },
        Profile {
            key: "fallout",
            runtime_hint: "Wine Stable",
            graphics: "dxvk",
            windows_version: "win10",
            dependencies: vec!["vcrun2019"],
            launch_arguments: vec![],
            compatibility: 91,
            notes: vec!["DirectX 11 runs near native speed with DXVK."],
        },
        Profile {
            key: "diablo",
            runtime_hint: "Wine-GE",
            graphics: "d3dmetal",
            windows_version: "win11",
            dependencies: vec!["vcrun2022"],
            launch_arguments: vec![],
            compatibility: 80,
            notes: vec!["Requires D3DMetal (DirectX 12) and Battle.net launcher."],
        },
        Profile {
            key: "hades",
            runtime_hint: "Wine Stable",
            graphics: "dxvk",
            windows_version: "win10",
            dependencies: vec![],
            launch_arguments: vec![],
            compatibility: 98,
            notes: vec!["Near-perfect compatibility and full controller support."],
        },
        Profile {
            key: "valorant",
            runtime_hint: "Wine Stable",
            graphics: "d3dmetal",
            windows_version: "win10",
            dependencies: vec![],
            launch_arguments: vec![],
            compatibility: 5,
            notes: vec![
                "Blocked: Riot Vanguard kernel-level anti-cheat driver cannot run on macOS/Wine.",
            ],
        },
        Profile {
            key: "fortnite",
            runtime_hint: "Wine Stable",
            graphics: "d3dmetal",
            windows_version: "win10",
            dependencies: vec![],
            launch_arguments: vec![],
            compatibility: 5,
            notes: vec![
                "Blocked: Easy Anti-Cheat / BattlEye kernel drivers are incompatible with Wine.",
            ],
        },
        Profile {
            key: "photoshop",
            runtime_hint: "Wine-GE",
            graphics: "d3dmetal",
            windows_version: "win10",
            dependencies: vec!["vcrun2022", "corefonts"],
            launch_arguments: vec![],
            compatibility: 88,
            notes: vec!["GPU acceleration may be limited in some filters."],
        },
        Profile {
            key: "autocad",
            runtime_hint: "Wine Stable",
            graphics: "dxvk",
            windows_version: "win10",
            dependencies: vec!["vcrun2019"],
            launch_arguments: vec![],
            compatibility: 72,
            notes: vec!["3D viewport rendering relies on WineD3D/DXVK."],
        },
        Profile {
            key: "steam",
            runtime_hint: "Wine Stable",
            graphics: "dxvk",
            windows_version: "win10",
            dependencies: vec!["corefonts"],
            launch_arguments: vec!["-noreactlogin".to_string()],
            compatibility: 90,
            notes: vec![],
        },
        Profile {
            key: "office",
            runtime_hint: "Wine Stable",
            graphics: "wined3d",
            windows_version: "win10",
            dependencies: vec!["corefonts"],
            launch_arguments: vec![],
            compatibility: 84,
            notes: vec!["Cloud features require modern browsers/WebView2."],
        },
        Profile {
            key: "notepad++",
            runtime_hint: "Wine Stable",
            graphics: "wined3d",
            windows_version: "win7",
            dependencies: vec![],
            launch_arguments: vec![],
            compatibility: 95,
            notes: vec![],
        },
        Profile {
            key: "gimp",
            runtime_hint: "Wine Stable",
            graphics: "wined3d",
            windows_version: "win10",
            dependencies: vec!["corefonts"],
            launch_arguments: vec![],
            compatibility: 90,
            notes: vec![],
        },
        Profile {
            key: "default",
            runtime_hint: "Wine Stable",
            graphics: "automatic",
            windows_version: "win10",
            dependencies: vec!["corefonts"],
            launch_arguments: vec![],
            compatibility: 80,
            notes: vec!["No specific profile found; general defaults applied."],
        },
    ]
}

/// Best-matching profile for an app name (also drives the installer wizard).
pub fn recommend(app_name: &str) -> Recommendation {
    let lower = app_name.to_lowercase();
    let all_profiles = profiles();
    let hit: Option<&Profile> = all_profiles.iter().find(|p| {
        if p.key == "default" {
            return false;
        }
        lower.contains(p.key)
    });
    let profile = hit.unwrap_or_else(|| &all_profiles[all_profiles.len() - 1]);
    Recommendation {
        profile: profile.key,
        runtime_hint: profile.runtime_hint,
        graphics: profile.graphics,
        windows_version: profile.windows_version,
        dependencies: profile.dependencies.clone(),
        launch_arguments: profile.launch_arguments.clone(),
        compatibility: profile.compatibility,
        notes: profile.notes.clone(),
    }
}

/// Adjust a recommendation's score based on what is actually available.
#[allow(dead_code, unused)]
pub fn adjusted_score(base: u32, runtime_available: bool, graphics: &str) -> u32 {
    let mut score = base;
    if !runtime_available {
        score = score.saturating_sub(20);
    }
    if graphics == "d3dmetal" {
        // exotic backends are best-effort for now
        score = score.saturating_sub(5);
    }
    score.min(99)
}

/// Persistable compatibility record for a registered application.
#[allow(dead_code, unused)]
pub fn profile_for_app(app_id: &str, rec: &Recommendation) -> serde_json::Value {
    serde_json::json!({
        "app_id": app_id,
        "profile": rec.profile,
        "runtime": rec.runtime_hint,
        "graphics": rec.graphics,
        "windows_version": rec.windows_version,
        "compatibility": rec.compatibility,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recommends_known_and_default() {
        let photoshop = recommend("Adobe Photoshop 2024");
        assert_eq!(photoshop.profile, "photoshop");
        assert_eq!(photoshop.graphics, "d3dmetal");

        let steam = recommend("Steam Installer");
        assert_eq!(steam.profile, "steam");

        let anything = recommend("RandomTool Foo");
        assert_eq!(anything.profile, "default");
        assert_eq!(anything.compatibility, 80);
    }

    #[test]
    fn missing_runtime_penalizes() {
        assert_eq!(adjusted_score(90, false, "wined3d"), 70);
        assert_eq!(adjusted_score(90, true, "dxvk"), 90);
    }
}
