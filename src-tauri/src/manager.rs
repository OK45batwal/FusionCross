// ponytail: save() is wired into mutation commands in the next layer.
#![allow(dead_code)]
use std::path::PathBuf;
use std::sync::Mutex;

use tauri::{AppHandle, Manager};

use crate::core::errors::FusionError;
use crate::core::state::AppState;

/// Process-wide access to the versioned `AppState`. Backend is the source of
/// truth for persistent data (PRD §49); the frontend only holds a mirror.
pub struct FusionState(pub Mutex<AppState>);

fn state_path(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|d| d.join("state.json"))
}

impl FusionState {
    /// Load or initialize state. A corrupt file degrades to defaults rather
    /// than crashing (PRD §52 migration support).
    pub fn load(app: &AppHandle) -> Self {
        let state = match state_path(app).and_then(|p| std::fs::read_to_string(p).ok()) {
            Some(raw) => AppState::from_raw(&raw).unwrap_or_default(),
            None => AppState::default(),
        };
        Self(Mutex::new(state))
    }

    pub fn save(&self, app: &AppHandle) -> Result<(), FusionError> {
        let path = state_path(app).ok_or(FusionError::InvalidPath)?;
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|_| FusionError::PermissionDenied)?;
        }
        let guard = self.0.lock().map_err(|_| FusionError::Unsupported)?;
        let data = serde_json::to_string_pretty(&*guard).map_err(|_| FusionError::Unsupported)?;
        std::fs::write(&path, data).map_err(|_| FusionError::PermissionDenied)
    }
}
