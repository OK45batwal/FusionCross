use serde::Serialize;
use tauri::State;

use crate::core::errors::FusionError;
use crate::core::state::AppState;
use crate::manager::FusionState;
use crate::wine::engine::{RuntimeEngine, WineEngine};

#[tauri::command]
pub fn get_state(state: State<'_, FusionState>) -> Result<AppState, FusionError> {
    Ok(state
        .0
        .lock()
        .map_err(|_| FusionError::Unsupported)?
        .clone())
}

#[derive(Debug, Clone, Serialize)]
pub struct SystemInfo {
    pub app_version: &'static str,
    pub arch: &'static str,
    pub os: &'static str,
    pub engines: Vec<&'static str>,
}

#[tauri::command]
pub fn get_system_info() -> Result<SystemInfo, FusionError> {
    Ok(SystemInfo {
        app_version: env!("CARGO_PKG_VERSION"),
        arch: std::env::consts::ARCH,
        os: std::env::consts::OS,
        engines: vec!["Wine Stable"],
    })
}

#[derive(Debug, Clone, Serialize)]
pub struct RuntimeStatus {
    pub name: String,
    pub version: String,
}

#[tauri::command]
pub fn probe_runtime(engine: &str) -> Result<RuntimeStatus, FusionError> {
    let e = WineEngine::new(engine);
    let version = e.version()?;
    Ok(RuntimeStatus {
        name: e.name().to_string(),
        version,
    })
}
