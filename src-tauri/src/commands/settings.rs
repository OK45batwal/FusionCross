#![allow(dead_code)]

use std::path::PathBuf;
use serde::Serialize;
use tauri::{AppHandle, Manager, State};

use crate::core::errors::FusionError;
use crate::core::state::AppState;
use crate::core::templates::{self, TEMPLATE_TYPES};
use crate::manager::{dirs, FusionState};

#[derive(Debug, Clone, Serialize)]
pub struct SystemInfo {
    pub app_version: &'static str,
    pub arch: &'static str,
    pub os: &'static str,
    pub engines: Vec<&'static str>,
}

#[tauri::command]
pub fn get_state(state: State<'_, FusionState>) -> Result<AppState, FusionError> {
    Ok(state
        .0
        .lock()
        .map_err(|_| FusionError::Unsupported)?
        .clone())
}

#[tauri::command]
pub fn get_system_info() -> Result<SystemInfo, FusionError> {
    Ok(SystemInfo {
        app_version: env!("CARGO_PKG_VERSION"),
        arch: std::env::consts::ARCH,
        os: std::env::consts::OS,
        engines: vec!["Whisky-Wine (Apple GPTK)", "Wine Stable"],
    })
}

#[tauri::command]
pub fn get_templates() -> Result<Vec<serde_json::Value>, FusionError> {
    Ok(TEMPLATE_TYPES
        .iter()
        .filter_map(|t| templates::bottle_template(t).ok())
        .map(|c| {
            serde_json::json!({
                "type": c.prefix_type,
                "label": c.label,
                "description": c.description,
                "windows_version": c.windows_version,
                "graphics": c.graphics,
                "dxvk_enabled": c.dxvk_enabled,
                "msync_enabled": c.msync_enabled,
                "performance_hud": c.performance_hud,
                "retina_mode": c.retina_mode,
                "dependencies": c.dependencies,
            })
        })
        .collect())
}

#[tauri::command]
pub fn set_safe_mode(app: AppHandle, enabled: bool) -> Result<(), FusionError> {
    let st = app.state::<FusionState>();
    st.with_state(|s| {
        if let Some(slot) = s.settings.iter_mut().find(|(k, _)| k == "safe_mode") {
            slot.1 = if enabled { "on" } else { "off" }.into();
        } else {
            s.settings.push((
                "safe_mode".into(),
                if enabled { "on" } else { "off" }.into(),
            ));
        }
        Ok(())
    })?;
    st.save(&app)
}

#[tauri::command]
#[allow(dead_code)]
pub fn set_setting(app: AppHandle, key: String, value: String) -> Result<(), FusionError> {
    let st = app.state::<FusionState>();
    st.with_state(|s| {
        if let Some(slot) = s.settings.iter_mut().find(|(k, _)| k == &key) {
            slot.1 = value;
        } else {
            s.settings.push((key, value));
        }
        Ok(())
    })?;
    st.save(&app)
}

#[tauri::command]
#[allow(dead_code)]
pub fn get_settings(app: AppHandle) -> Result<Vec<(String, String)>, FusionError> {
    let st = app.state::<FusionState>();
    st.with_state(|s| Ok(s.settings.clone()))
}

#[tauri::command]
pub fn export_app_bundle(app: AppHandle, app_id: String) -> Result<String, FusionError> {
    let st = app.state::<FusionState>();
    let application = st.with_state(|s| {
        s.applications
            .iter()
            .find(|a| a.id == app_id)
            .cloned()
            .ok_or(FusionError::ApplicationNotFound)
    })?;

    let home = std::env::var("HOME").map_err(|_| FusionError::Unsupported)?;
    let target_dir = PathBuf::from(home).join("Applications").join("FusionCross");
    let bundle_path =
        crate::exporter::create_mac_app_bundle(&application.name, &application.id, &target_dir)?;
    Ok(bundle_path.to_string_lossy().into_owned())
}

#[tauri::command]
#[allow(dead_code)]
pub fn open_logs_directory(app: AppHandle) -> Result<(), FusionError> {
    let d = dirs(&app);
    d.ensure()?;
    std::process::Command::new("open")
        .arg(&d.logs)
        .spawn()
        .map_err(|_| FusionError::LaunchFailed)?;
    Ok(())
}
