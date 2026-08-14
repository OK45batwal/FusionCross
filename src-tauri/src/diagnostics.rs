use serde::Serialize;

use crate::core::state::AppState;

/// What a diagnostic problem needs to be fixed. Interpreted by the command
/// layer, so fixes are actionable and verifiable (PRD §36–37).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FixIntent {
    InstallRuntime,
    InitPrefix,
    InstallDependency(String),
    SwitchGraphics,
}

impl FixIntent {
    pub fn id(&self) -> String {
        match self {
            FixIntent::InstallRuntime => "install_runtime".into(),
            FixIntent::InitPrefix => "init_prefix".into(),
            FixIntent::InstallDependency(v) => format!("install_dep:{v}"),
            FixIntent::SwitchGraphics => "switch_graphics".into(),
        }
    }

    pub fn from_id(id: &str) -> Option<Self> {
        if let Some(verb) = id.strip_prefix("install_dep:") {
            return Some(FixIntent::InstallDependency(verb.to_string()));
        }
        match id {
            "install_runtime" => Some(FixIntent::InstallRuntime),
            "init_prefix" => Some(FixIntent::InitPrefix),
            "switch_graphics" => Some(FixIntent::SwitchGraphics),
            _ => None,
        }
    }

    #[allow(dead_code)]
    pub fn label(&self) -> String {
        match self {
            FixIntent::InstallRuntime => "Install a Wine runtime".into(),
            FixIntent::InitPrefix => "Initialize the bottle prefix".into(),
            FixIntent::InstallDependency(v) => format!("Install dependency: {v}"),
            FixIntent::SwitchGraphics => "Switch graphics backend".into(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct DiagnosticCheck {
    pub id: &'static str,
    pub label: &'static str,
    pub status: &'static str,
    pub detail: String,
    pub fix: Option<String>,
}

/// Run environment checks for launching an application (PRD §36).
pub fn run_app_diagnostics(state: &AppState, app_id: &str) -> Vec<DiagnosticCheck> {
    let mut checks = Vec::new();
    let app = match state.applications.iter().find(|a| a.id == app_id) {
        Some(a) => a,
        None => {
            return vec![DiagnosticCheck {
                id: "application",
                label: "Application",
                status: "fail",
                detail: "Application record not found in state.".into(),
                fix: None,
            }];
        }
    };
    let bottle = state.bottles.iter().find(|b| b.id == app.bottle_id);
    let runtime = state.runtimes.iter().find(|r| r.id == bottle.map(|b| b.runtime.as_str()).unwrap_or(""));

    // Bottle
    checks.push(DiagnosticCheck {
        id: "bottle",
        label: "Bottle",
        status: if bottle.is_some() { "ok" } else { "fail" },
        detail: device_bottle(&app.bottle_id),
        fix: None,
    });

    // Runtime
    let runtime_ok = runtime.map(|r| r.downloaded).unwrap_or(false) || wine_on_path();
    checks.push(DiagnosticCheck {
        id: "runtime",
        label: "Runtime",
        status: if runtime_ok { "ok" } else { "fail" },
        detail: bottle
            .map(|b| format!("{} — {}", b.runtime, if runtime_ok { "available" } else { "missing" }))
            .unwrap_or_else(|| "no bottle → no runtime".into()),
        fix: if runtime_ok { None } else { Some(FixIntent::InstallRuntime.id()) },
    });

    // Prefix initialized
    let prefix_ok = bottle.map(|b| std::path::Path::new(&b.path).join("drive_c").join("windows").exists()).unwrap_or(false);
    checks.push(DiagnosticCheck {
        id: "prefix",
        label: "Prefix",
        status: if prefix_ok { "ok" } else { "warn" },
        detail: if prefix_ok { "drive_c initialized" } else { "prefix not initialized (first launch will create it)" }.into(),
        fix: if prefix_ok { None } else { Some(FixIntent::InitPrefix.id()) },
    });

    // Executable
    let exe_ok = std::path::Path::new(&app.executable_path).exists();
    checks.push(DiagnosticCheck {
        id: "executable",
        label: "Executable",
        status: if exe_ok { "ok" } else { "fail" },
        detail: if exe_ok { app.executable_path.clone() } else { "Executable file is missing.".into() },
        fix: None,
    });

    // Dependencies
    let deps = bottle.map(|b| b.dependencies.clone()).unwrap_or_default();
    if !deps.is_empty() {
        let wt = std::process::Command::new("winetricks").arg("--version").output().is_ok();
        checks.push(DiagnosticCheck {
            id: "dependencies",
            label: "Dependencies",
            status: if wt { "ok" } else { "warn" },
            detail: if wt {
                format!("winetricks verbs queued: {}", deps.join(", "))
            } else {
                "winetricks not installed — dependencies skipped".into()
            },
            fix: None,
        });
    }

    // Graphics (warn-only; never blocks launch)
    if let Some(b) = bottle {
        if b.dxvk_enabled {
            checks.push(DiagnosticCheck {
                id: "graphics",
                label: "Graphics",
                status: "warn",
                detail: format!("DXVK is enabled on the {} backend.", b.graphics),
                fix: Some(FixIntent::SwitchGraphics.id()),
            });
        }
    }
    checks
}

fn device_bottle(id: &str) -> String {
    if id.is_empty() { "no bottle assigned".into() } else { format!("bottle {id}") }
}

fn wine_on_path() -> bool {
    std::process::Command::new("wine").arg("--version").output().is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::state::Bottle;

    fn state_with_app() -> AppState {
        let mut s = AppState::default();
        s.bottles.push(Bottle {
            id: "b1".into(),
            name: "Gaming".into(),
            prefix_type: "gaming".into(),
            runtime: "Wine Stable".into(),
            windows_version: "win10".into(),
            graphics: "dxvk".into(),
            dxvk_enabled: true,
            path: "/nonexistent/b1".into(),
            created_at: "".into(),
            last_used_at: None,
            environment: vec![],
            dll_overrides: vec![],
            dependencies: vec![],
        });
        s.applications.push(crate::core::state::Application {
            id: "a1".into(),
            bottle_id: "b1".into(),
            name: "Foo".into(),
            executable_path: "/nonexistent/foo.exe".into(),
            category: "applications".into(),
            favorite: false,
            launch_count: 0,
            play_time_mins: 0,
            last_played: None,
            compatibility: None,
            profile: None,
        });
        s
    }

    #[test]
    fn diagnostics_cover_all_checks() {
        let state = state_with_app();
        let checks = run_app_diagnostics(&state, "a1");
        let ids: Vec<_> = checks.iter().map(|c| c.id).collect();
        assert!(ids.contains(&"bottle"));
        assert!(ids.contains(&"prefix"));
        assert!(ids.contains(&"executable"));
        // executable missing → fail
        let exe = checks.iter().find(|c| c.id == "executable").unwrap();
        assert_eq!(exe.status, "fail");
        // missing runtime → actionable fix
        let rt = checks.iter().find(|c| c.id == "runtime").unwrap();
        assert_eq!(rt.fix, Some("install_runtime".to_string()));
    }
}