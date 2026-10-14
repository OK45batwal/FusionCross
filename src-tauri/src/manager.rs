use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::core::errors::FusionError;
use crate::core::state::AppState;

fn app_data_dir(app: &AppHandle) -> Option<PathBuf> {
    // Disposable data directories for local debug smoke tests only.
    #[cfg(debug_assertions)]
    if let Some(path) = std::env::var_os("FUSIONCROSS_DATA_DIR").map(PathBuf::from) {
        if path.is_absolute() && path.parent().is_some() {
            return Some(path);
        }
    }
    app.path().app_data_dir().ok()
}

pub fn dirs(app: &AppHandle) -> Dirs {
    let base = app_data_dir(app).unwrap_or_else(|| PathBuf::from("/tmp/fusioncross"));
    let home = std::env::var("HOME").unwrap_or_default();
    let legacy_libraries =
        PathBuf::from(&home).join("Library/Application Support/FusionCross/libraries");
    let libraries = if legacy_libraries.exists() {
        legacy_libraries
    } else {
        base.join("libraries")
    };

    Dirs {
        base: base.clone(),
        bottles: base.join("bottles"),
        runtimes: base.join("runtimes"),
        snapshots: base.join("snapshots"),
        downloads: base.join("downloads"),
        libraries,
        logs: base.join("logs"),
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
    pub libraries: PathBuf,
    pub logs: PathBuf,
    pub state: PathBuf,
}

impl Dirs {
    pub fn ensure(&self) -> Result<(), FusionError> {
        for d in [
            &self.bottles,
            &self.runtimes,
            &self.snapshots,
            &self.downloads,
            &self.libraries,
            &self.logs,
        ] {
            std::fs::create_dir_all(d).map_err(|_| FusionError::PermissionDenied)?;
        }
        Ok(())
    }
}

/// Process-wide access to the versioned `AppState`. The backend is the source
/// of truth (PRD §49); the frontend only mirrors it.
pub struct FusionState(pub Mutex<AppState>, PathBuf, pub Option<String>);

impl FusionState {
    /// Recover a valid backup or stop startup while preserving unreadable data.
    pub fn load(app: &AppHandle) -> Result<Self, Box<dyn std::error::Error>> {
        let d = dirs(app);
        d.ensure()?;
        let (mut state, notice) = crate::core::storage::load(&d.state)?;
        let loaded = state.clone();

        // Reconcile any existing bottle prefixes found on disk
        if d.bottles.is_dir() {
            if let Ok(entries) = std::fs::read_dir(&d.bottles) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        let id = entry.file_name().to_string_lossy().into_owned();
                        if id.starts_with('.') {
                            continue;
                        }
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
        for bottle in state.bottles.clone() {
            let found = crate::wine::scanner::scan_prefix(std::path::Path::new(&bottle.path));
            crate::commands::installers::register_discovered(
                &mut state,
                &bottle.id,
                std::path::Path::new(&bottle.path),
                &found,
            );
        }

        // Clean up bogus applications (such as symlinks escaping to dosdevices/z:,
        // or helper/installer/uninstaller binaries that should not appear on the user's shelf)
        state.applications.retain(|app| {
            let p = std::path::Path::new(&app.executable_path);
            !app.executable_path.contains("dosdevices/z:")
                && !app.executable_path.contains("/opt/homebrew/")
                && !app.executable_path.contains("/site-packages/")
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

        if state != loaded || !d.state.exists() {
            crate::core::storage::save(&d.state, &state)?;
        }
        let st = Self(Mutex::new(state), d.state, notice);
        Ok(st)
    }

    pub fn with_state<R>(
        &self,
        f: impl FnOnce(&AppState) -> Result<R, FusionError>,
    ) -> Result<R, FusionError> {
        let guard = self.0.lock().map_err(|_| FusionError::Unsupported)?;
        f(&guard)
    }

    /// Persist before publishing a mutation, so a failed write cannot leave
    /// the in-memory library ahead of what will survive a restart.
    pub fn update<R>(
        &self,
        f: impl FnOnce(&mut AppState) -> Result<R, FusionError>,
    ) -> Result<R, FusionError> {
        let mut guard = self.0.lock().map_err(|_| FusionError::Unsupported)?;
        let mut next = guard.clone();
        let result = f(&mut next)?;
        if next == *guard {
            return Ok(result);
        }
        crate::core::storage::save(&self.1, &next).map_err(|_| FusionError::PermissionDenied)?;
        *guard = next;
        Ok(result)
    }
}

/// Always put a background job into a terminal state when its worker panics
/// or cannot be started, so polling never reports it as running forever.
pub fn spawn_job(app: AppHandle, job_id: String, task: impl FnOnce() + Send + 'static) {
    let worker_app = app.clone();
    let worker_id = job_id.clone();
    let result = std::thread::Builder::new().spawn(move || {
        if std::panic::catch_unwind(std::panic::AssertUnwindSafe(task)).is_err() {
            worker_app.state::<Jobs>().fail(
                &worker_id,
                "The background task stopped unexpectedly. Check the logs before retrying.".into(),
            );
        }
    });
    if let Err(error) = result {
        app.state::<Jobs>().fail(
            &job_id,
            format!("Could not start the background task: {error}"),
        );
    }
}

/// Long-running jobs (installs, runtime downloads) run on a thread and report
/// back here; the frontend polls while they spin.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum JobStatus {
    Running,
    Done,
    Failed,
    Cancelling,
    Cancelled,
}

#[derive(Debug, Clone, Serialize)]
pub struct Job {
    pub id: String,
    pub title: String,
    pub status: JobStatus,
    pub message: String,
    pub can_cancel: bool,
    #[serde(skip)]
    control: Option<std::sync::Arc<crate::process::job::JobControl>>,
    #[serde(skip)]
    finished_at: Option<std::time::Instant>,
}

#[derive(Default)]
pub struct Jobs(pub Mutex<HashMap<String, Job>>);

impl Jobs {
    pub fn begin(&self, title: String) -> String {
        let id = crate::core::ids::new_id();
        let mut jobs = self.0.lock().unwrap_or_else(|e| e.into_inner());
        Self::prune(&mut jobs);
        jobs.insert(
            id.clone(),
            Job {
                id: id.clone(),
                title,
                status: JobStatus::Running,
                message: "working…".into(),
                can_cancel: false,
                control: None,
                finished_at: None,
            },
        );
        id
    }

    pub fn begin_cancellable(
        &self,
        title: String,
    ) -> (String, std::sync::Arc<crate::process::job::JobControl>) {
        let id = self.begin(title);
        let control = std::sync::Arc::new(crate::process::job::JobControl::default());
        if let Some(job) = self
            .0
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .get_mut(&id)
        {
            job.control = Some(control.clone());
            job.can_cancel = true;
        }
        (id, control)
    }

    pub fn cancel(&self, id: &str) -> Result<(), FusionError> {
        let mut jobs = self.0.lock().map_err(|_| FusionError::Unsupported)?;
        let job = jobs.get_mut(id).ok_or(FusionError::InvalidInput)?;
        if job.finished_at.is_some()
            || !job.control.as_ref().is_some_and(|control| control.cancel())
        {
            return Err(FusionError::Unsupported);
        }
        job.status = JobStatus::Cancelling;
        job.can_cancel = false;
        job.message = "Stopping… Files already installed may remain.".into();
        Ok(())
    }

    pub fn finish(&self, id: &str, message: String) {
        if let Some(j) = self.0.lock().unwrap_or_else(|e| e.into_inner()).get_mut(id) {
            j.status = JobStatus::Done;
            j.message = message;
            Self::terminal(j);
            j.finished_at = Some(std::time::Instant::now());
        }
    }

    pub fn fail(&self, id: &str, message: String) {
        if let Some(j) = self.0.lock().unwrap_or_else(|e| e.into_inner()).get_mut(id) {
            j.status = JobStatus::Failed;
            j.message = message;
            Self::terminal(j);
            j.finished_at = Some(std::time::Instant::now());
        }
    }

    pub fn list(&self) -> Vec<Job> {
        let mut jobs = self.0.lock().unwrap_or_else(|e| e.into_inner());
        Self::prune(&mut jobs);
        for job in jobs.values_mut() {
            job.can_cancel = job.finished_at.is_none()
                && job
                    .control
                    .as_ref()
                    .is_some_and(|control| control.can_cancel());
        }
        jobs.values().cloned().collect()
    }

    fn prune(jobs: &mut HashMap<String, Job>) {
        jobs.retain(|_, j| {
            j.finished_at
                .is_none_or(|t| t.elapsed() < std::time::Duration::from_secs(3600))
        });
        let mut completed: Vec<_> = jobs
            .values()
            .filter_map(|j| j.finished_at.map(|t| (j.id.clone(), t)))
            .collect();
        completed.sort_by_key(|(_, time)| *time);
        let excess = completed.len().saturating_sub(100);
        for (id, _) in completed.into_iter().take(excess) {
            jobs.remove(&id);
        }
    }

    fn terminal(job: &mut Job) {
        job.can_cancel = false;
        if let Some(control) = &job.control {
            if control.seal().is_err() {
                job.status = JobStatus::Cancelled;
                job.message = FusionError::Cancelled.to_string();
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn job_status_contract_and_cancellation_are_visible_to_frontend() {
        let jobs = Jobs::default();
        let (id, control) = jobs.begin_cancellable("Install".into());
        assert_eq!(
            serde_json::to_value(&jobs.list()[0]).unwrap()["status"],
            "running"
        );
        jobs.cancel(&id).unwrap();
        assert!(control.check().is_err());
        assert_eq!(
            serde_json::to_value(&jobs.list()[0]).unwrap()["status"],
            "cancelling"
        );
        jobs.fail(&id, "stopped".into());
        let json = serde_json::to_value(&jobs.list()[0]).unwrap();
        assert_eq!(json["status"], "cancelled");
        assert_eq!(json["can_cancel"], false);
        assert!(jobs.cancel(&id).is_err());
    }

    #[test]
    fn failed_persistence_does_not_publish_mutation() {
        let dir =
            std::env::temp_dir().join(format!("fc_transaction_{}", crate::core::ids::new_id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("state.json");
        std::fs::write(&path, "broken").unwrap();
        let state = FusionState(Mutex::new(AppState::default()), path, None);
        assert!(state
            .update(|s| {
                s.settings.clear();
                Ok(())
            })
            .is_err());
        assert_eq!(state.0.lock().unwrap().settings.len(), 1);
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn jobs_retain_active_work_and_bound_completed_history() {
        let jobs = Jobs::default();
        let active = jobs.begin("active".into());
        for _ in 0..150 {
            let id = jobs.begin("test".into());
            jobs.finish(&id, "done".into());
        }
        let listed = jobs.list();
        assert_eq!(listed.len(), 101);
        assert!(listed.iter().any(|j| j.id == active));
    }
}
