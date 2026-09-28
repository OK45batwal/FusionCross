use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::core::errors::FusionError;
use crate::core::state::AppState;

fn app_data_dir(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok()
}

pub fn dirs(app: &AppHandle) -> Dirs {
    let base = app_data_dir(app).unwrap_or_else(|| PathBuf::from("/tmp/fusioncross"));
    Dirs {
        base: base.clone(),
        bottles: base.join("bottles"),
        runtimes: base.join("runtimes"),
        snapshots: base.join("snapshots"),
        downloads: base.join("downloads"),
        state: base.join("state.json"),
    }
}

#[derive(Debug, Clone)]
#[allow(dead_code, unused)]
pub struct Dirs {
    #[allow(dead_code)]
    pub base: PathBuf,
    pub bottles: PathBuf,
    pub runtimes: PathBuf,
    pub snapshots: PathBuf,
    pub downloads: PathBuf,
    pub state: PathBuf,
}

impl Dirs {
    fn ensure(&self) -> Result<(), FusionError> {
        for d in [
            &self.bottles,
            &self.runtimes,
            &self.snapshots,
            &self.downloads,
        ] {
            std::fs::create_dir_all(d).map_err(|_| FusionError::PermissionDenied)?;
        }
        Ok(())
    }
}

/// Process-wide access to the versioned `AppState`. The backend is the source
/// of truth (PRD §49); the frontend only mirrors it.
pub struct FusionState(pub Mutex<AppState>);

impl FusionState {
    /// Load or initialize state; corrupt files degrade to defaults.
    pub fn load(app: &AppHandle) -> Self {
        let d = dirs(app);
        d.ensure().ok();
        let mut state = match std::fs::read_to_string(&d.state) {
            Ok(raw) => AppState::from_raw(&raw).unwrap_or_default(),
            Err(_) => AppState::default(),
        };

        // Reconcile any existing bottle prefixes found on disk
        if d.bottles.is_dir() {
            if let Ok(entries) = std::fs::read_dir(&d.bottles) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        let id = entry.file_name().to_string_lossy().into_owned();
                        let has_prefix =
                            path.join("drive_c").is_dir() || path.join("system.reg").is_file();
                        if has_prefix
                            && !state
                                .bottles
                                .iter()
                                .any(|b| b.id == id || b.path == path.to_string_lossy())
                        {
                            let name = if id == "bottle-2ff1dd5a" {
                                "Steam".to_string()
                            } else if id == "bottle-61d41d23" {
                                "Steam Gaming".to_string()
                            } else {
                                format!("Bottle {}", id.trim_start_matches("bottle-"))
                            };
                            state.bottles.push(crate::core::state::Bottle {
                                id: id.clone(),
                                name,
                                prefix_type: "gaming".into(),
                                runtime: "Whisky-Wine (Apple GPTK)".into(),
                                windows_version: "win10".into(),
                                graphics: "automatic".into(),
                                dxvk_enabled: true,
                                msync_enabled: true,
                                performance_hud: false,
                                retina_mode: false,
                                path: path.to_string_lossy().into_owned(),
                                created_at: "2026-08-09T00:00:00Z".into(),
                                last_used_at: None,
                                environment: vec![],
                                dll_overrides: vec!["d3d11".into(), "dxgi".into()],
                                dependencies: vec![],
                            });
                        }
                    }
                }
            }
        }

        // Auto-scan each bottle for installed executables into state.applications
        for bottle in &state.bottles {
            let found = crate::wine::scanner::scan_prefix(std::path::Path::new(&bottle.path));
            for exe in found {
                let full_path = std::path::Path::new(&bottle.path)
                    .join(&exe.rel_path)
                    .to_string_lossy()
                    .into_owned();
                if !state.applications.iter().any(|a| {
                    a.bottle_id == bottle.id
                        && (a.executable_path == full_path || a.name == exe.name)
                }) {
                    let rec = crate::compatibility::recommend(&exe.name);
                    let icon_data =
                        crate::wine::icon::extract_icon_data_url(std::path::Path::new(&full_path));
                    state.applications.push(crate::core::state::Application {
                        id: crate::core::ids::new_id(),
                        bottle_id: bottle.id.clone(),
                        name: exe.name,
                        executable_path: full_path,
                        category: exe.category,
                        favorite: false,
                        launch_count: 0,
                        play_time_mins: 0,
                        last_played: None,
                        compatibility: Some(rec.compatibility),
                        profile: Some(rec.profile.to_string()),
                        icon_data,
                    });
                }
            }
        }

        // Clean up any bogus applications (such as symlinks escaping to dosdevices/z:, non-existent files,
        // or helper/installer/uninstaller binaries that should not appear on the user's shelf)
        state.applications.retain(|app| {
            let p = std::path::Path::new(&app.executable_path);
            !app.executable_path.contains("dosdevices/z:")
                && !app.executable_path.contains("/opt/homebrew/")
                && !app.executable_path.contains("/site-packages/")
                && p.exists()
                && !crate::wine::scanner::is_ignored_exe(p)
        });

        // Ensure all valid applications have icons extracted
        for app_entry in &mut state.applications {
            if app_entry.icon_data.is_none() {
                app_entry.icon_data = crate::wine::icon::extract_icon_data_url(
                    std::path::Path::new(&app_entry.executable_path),
                );
            }
        }

        let st = Self(Mutex::new(state));
        st.save(app).ok();
        st
    }

    pub fn with_state<R>(
        &self,
        f: impl FnOnce(&mut AppState) -> Result<R, FusionError>,
    ) -> Result<R, FusionError> {
        let mut guard = self.0.lock().map_err(|_| FusionError::Unsupported)?;
        f(&mut guard)
    }

    pub fn save(&self, app: &AppHandle) -> Result<(), FusionError> {
        let path = dirs(app).state;
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|_| FusionError::PermissionDenied)?;
        }
        let guard = self.0.lock().map_err(|_| FusionError::Unsupported)?;
        let data = serde_json::to_string_pretty(&*guard).map_err(|_| FusionError::Unsupported)?;
        std::fs::write(&path, data).map_err(|_| FusionError::PermissionDenied)
    }
}

/// Long-running jobs (installs, runtime downloads) run on a thread and report
/// back here; the frontend polls while they spin.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "state", content = "message", rename_all = "lowercase")]
pub enum JobStatus {
    Running,
    Done,
    Failed,
}

#[derive(Debug, Clone, Serialize)]
pub struct Job {
    pub id: String,
    pub title: String,
    pub status: JobStatus,
    pub message: String,
}

#[derive(Default)]
pub struct Jobs(pub Mutex<HashMap<String, Job>>);

impl Jobs {
    pub fn begin(&self, title: String) -> String {
        let id = crate::core::ids::new_id();
        self.0.lock().unwrap().insert(
            id.clone(),
            Job {
                id: id.clone(),
                title,
                status: JobStatus::Running,
                message: "working…".into(),
            },
        );
        id
    }

    pub fn finish(&self, id: &str, message: String) {
        if let Some(j) = self.0.lock().unwrap().get_mut(id) {
            j.status = JobStatus::Done;
            j.message = message;
        }
    }

    pub fn fail(&self, id: &str, message: String) {
        if let Some(j) = self.0.lock().unwrap().get_mut(id) {
            j.status = JobStatus::Failed;
            j.message = message;
        }
    }

    pub fn list(&self) -> Vec<Job> {
        self.0.lock().unwrap().values().cloned().collect()
    }
}
