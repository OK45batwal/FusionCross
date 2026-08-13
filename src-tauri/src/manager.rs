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
pub struct Dirs {
    pub base: PathBuf,
    pub bottles: PathBuf,
    pub runtimes: PathBuf,
    pub snapshots: PathBuf,
    pub downloads: PathBuf,
    pub state: PathBuf,
}

impl Dirs {
    fn ensure(&self) -> Result<(), FusionError> {
        for d in [&self.bottles, &self.runtimes, &self.snapshots, &self.downloads] {
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
        let state = match std::fs::read_to_string(&d.state) {
            Ok(raw) => AppState::from_raw(&raw).unwrap_or_default(),
            Err(_) => AppState::default(),
        };
        Self(Mutex::new(state))
    }

    pub fn with_state<R>(&self, f: impl FnOnce(&mut AppState) -> Result<R, FusionError>) -> Result<R, FusionError> {
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
#[serde(tag = "state", content = "message")]
pub enum JobStatus {
    running,
    done,
    failed,
}

#[derive(Debug, Clone, Serialize)]
pub struct Job {
    pub id: String,
    pub title: String,
    pub status: JobStatus,
    pub message: String,
}

pub struct Jobs(pub Mutex<HashMap<String, Job>>);

impl Jobs {
    pub fn begin(&self, title: String) -> String {
        let id = crate::core::ids::new_id();
        self.0.lock().unwrap().insert(
            id.clone(),
            Job { id: id.clone(), title, status: JobStatus::running, message: "working…".into() },
        );
        id
    }

    pub fn finish(&self, id: &str, message: String) {
        if let Some(j) = self.0.lock().unwrap().get_mut(id) {
            j.status = JobStatus::done;
            j.message = message;
        }
    }

    pub fn fail(&self, id: &str, message: String) {
        if let Some(j) = self.0.lock().unwrap().get_mut(id) {
            j.status = JobStatus::failed;
            j.message = message;
        }
    }

    pub fn list(&self) -> Vec<Job> {
        self.0.lock().unwrap().values().cloned().collect()
    }
}