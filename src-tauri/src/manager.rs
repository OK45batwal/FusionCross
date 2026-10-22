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
    // Fall back to the per-user Application Support path, never a shared /tmp.
    let fallback = std::env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir)
        .join("Library/Application Support/FusionCross");
    let base = app_data_dir(app).unwrap_or(fallback);
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

        // Bridge libraries created under the older bundle identifiers. Paths
        // are registered where they already live — nothing is copied.
        migrate_legacy(&mut state, &legacy_bases());

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
                            let name = format!("Bottle {}", id.trim_start_matches("bottle-"));
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

        sanitize_applications(&mut state);

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

/// One-time bridge from the older bundle identifiers. Bottles and runtimes are
/// re-registered at their existing paths; nothing is copied or moved.
fn migrate_legacy(state: &mut AppState, bases: &[PathBuf]) {
    if !state.bottles.is_empty() {
        return;
    }
    for base in bases {
        let Ok((legacy, _)) = crate::core::storage::load(&base.join("state.json")) else {
            continue;
        };
        for bottle in legacy.bottles {
            let prefix = std::path::Path::new(&bottle.path);
            let usable = prefix.join("drive_c").is_dir() || prefix.join("system.reg").is_file();
            if usable && !state.bottles.iter().any(|b| b.id == bottle.id) {
                state.bottles.push(bottle);
            }
        }
        for runtime in legacy.runtimes {
            let usable =
                crate::runtime::engine_binary(std::path::Path::new(&runtime.path)).is_some();
            if usable && !state.runtimes.iter().any(|r| r.id == runtime.id) {
                state.runtimes.push(runtime);
            }
        }
    }
}

fn legacy_bases() -> Vec<PathBuf> {
    let Some(home) = std::env::var_os("HOME").map(PathBuf::from) else {
        return Vec::new();
    };
    ["FusionCross", "com.fusioncross.app"]
        .into_iter()
        .map(|name| home.join("Library/Application Support").join(name))
        .collect()
}

/// Drop entries that point outside the bottle, at helper binaries, or at the
/// legacy `dosdevices` alias of the same `drive_c` file.
fn sanitize_applications(state: &mut AppState) {
    state.applications.retain(|app| {
        let path = std::path::Path::new(&app.executable_path);
        !app.executable_path.contains("dosdevices/")
            && !app.executable_path.contains("/opt/homebrew/")
            && !app.executable_path.contains("/site-packages/")
            && !crate::wine::scanner::is_ignored_exe(path)
    });
}

/// Drop library entries whose executable vanished (uninstalled Steam game),
/// but only when the bottle itself is still on this Mac.
fn prune_missing_applications(
    state: &mut AppState,
    scanned: &[(String, PathBuf, Vec<crate::wine::scanner::DiscoveredExe>)],
) {
    state.applications.retain(|app| {
        let Some((_, prefix, _)) = scanned.iter().find(|(id, _, _)| *id == app.bottle_id) else {
            return true;
        };
        !prefix.is_dir() || std::path::Path::new(&app.executable_path).is_file()
    });
}

/// Index every bottle once, off the UI thread. Startup no longer blocks on
/// walking prefixes and extracting icons.
pub fn scan_and_index(app: &AppHandle) {
    let st = app.state::<FusionState>();
    let bottles = match st.with_state(|s| Ok(s.bottles.clone())) {
        Ok(bottles) => bottles,
        Err(_) => return,
    };
    let scanned: Vec<_> = bottles
        .into_iter()
        .map(|bottle| {
            let prefix = PathBuf::from(&bottle.path);
            let found = crate::wine::scanner::scan_prefix(&prefix);
            (bottle.id, prefix, found)
        })
        .collect();
    let _ = st.update(|state| {
        for (id, prefix, found) in &scanned {
            crate::commands::installers::register_discovered(state, id, prefix, found);
        }
        sanitize_applications(state);
        prune_missing_applications(state, &scanned);
        for application in &mut state.applications {
            if application.icon_data.is_none() {
                application.icon_data = crate::wine::icon::extract_icon_data_url(
                    std::path::Path::new(&application.executable_path),
                );
            }
        }
        Ok(())
    });
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
    use crate::core::ids::new_id;
    use crate::core::state::{Bottle, Runtime};
    use std::path::Path;

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

    fn bottle(id: &str, path: &Path) -> Bottle {
        Bottle {
            id: id.into(),
            name: id.into(),
            prefix_type: "gaming".into(),
            runtime: "Wine Stable".into(),
            windows_version: "win10".into(),
            graphics: "automatic".into(),
            dxvk_enabled: true,
            msync_enabled: true,
            performance_hud: false,
            retina_mode: false,
            path: path.to_string_lossy().into_owned(),
            created_at: "2026-01-01T00:00:00Z".into(),
            last_used_at: None,
            environment: vec![],
            dll_overrides: vec![],
            dependencies: vec![],
        }
    }

    fn runtime(id: &str, path: &Path) -> Runtime {
        Runtime {
            id: id.into(),
            name: id.into(),
            category: "wine".into(),
            downloaded: true,
            version: "9.0".into(),
            path: path.to_string_lossy().into_owned(),
            url: String::new(),
            sha256: String::new(),
            size_bytes: 0,
        }
    }

    #[test]
    fn migrates_only_usable_entries_from_legacy_bases() {
        let root = std::env::temp_dir().join(format!("fc_migrate_{}", new_id()));
        std::fs::create_dir_all(root.join("live/drive_c")).unwrap();
        std::fs::create_dir_all(root.join("legacy/runtimes/wine/bin")).unwrap();
        std::fs::write(root.join("legacy/runtimes/wine/bin/wine64"), b"stub").unwrap();

        let legacy_base = root.join("legacy");
        let mut old = AppState::default();
        old.bottles.push(bottle("kept", &root.join("live")));
        old.bottles.push(bottle("missing", &root.join("gone")));
        old.runtimes
            .push(runtime("wine", &root.join("legacy/runtimes/wine")));
        old.runtimes
            .push(runtime("gone", &root.join("runtimes/gone")));
        crate::core::storage::save(&legacy_base.join("state.json"), &old).unwrap();

        let mut state = AppState::default();
        migrate_legacy(&mut state, &[legacy_base]);
        assert_eq!(state.bottles.len(), 1);
        assert_eq!(state.bottles[0].id, "kept");
        assert_eq!(state.runtimes.len(), 1);
        assert_eq!(state.runtimes[0].id, "wine");

        std::fs::remove_dir_all(root).ok();
    }

    fn application(
        id: &str,
        bottle_id: &str,
        executable: &Path,
    ) -> crate::core::state::Application {
        serde_json::from_value(serde_json::json!({
            "id": id,
            "bottle_id": bottle_id,
            "name": id,
            "executable_path": executable.to_string_lossy(),
        }))
        .unwrap()
    }

    #[test]
    fn prunes_library_entries_whose_executable_is_gone() {
        let root = std::env::temp_dir().join(format!("fc_prune_{}", new_id()));
        let prefix = root.join("bottle");
        std::fs::create_dir_all(prefix.join("drive_c")).unwrap();
        let live = prefix.join("drive_c/live.exe");
        std::fs::write(&live, b"stub").unwrap();

        let mut state = AppState::default();
        state.applications.push(application("live", "b", &live));
        state
            .applications
            .push(application("ghost", "b", &prefix.join("drive_c/gone.exe")));
        state.applications.push(application(
            "offline",
            "c",
            &root.join("unmounted/thing.exe"),
        ));

        // The bottle is present: the ghost goes, the live exe stays.
        prune_missing_applications(&mut state, &[("b".to_string(), prefix.clone(), Vec::new())]);
        assert_eq!(state.applications.len(), 2);
        assert!(state.applications.iter().all(|a| a.id != "ghost"));

        // The bottle is gone (unmounted volume): keep its entries untouched.
        let mut state = AppState::default();
        state.applications.push(application(
            "offline",
            "b",
            &root.join("unmounted/thing.exe"),
        ));
        prune_missing_applications(
            &mut state,
            &[("b".to_string(), root.join("unmounted"), Vec::new())],
        );
        assert_eq!(state.applications.len(), 1);

        std::fs::remove_dir_all(root).ok();
    }

    #[test]
    fn never_overwrites_a_library_that_already_has_bottles() {
        let mut state = AppState::default();
        state.bottles.push(bottle("own", Path::new("/tmp")));
        migrate_legacy(&mut state, &[PathBuf::from("/definitely/not/a/base")]);
        assert_eq!(state.bottles.len(), 1);
        assert_eq!(state.bottles[0].id, "own");
    }
}
