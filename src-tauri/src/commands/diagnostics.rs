use std::path::Path;
use tauri::{AppHandle, Manager};

use crate::compatibility::{self, Recommendation};
use crate::core::errors::FusionError;
use crate::diagnostics::{self, FixIntent};
use crate::manager::FusionState;

use super::wine_binary_for;

#[tauri::command]
pub fn get_recommendation(name: String) -> Result<Recommendation, FusionError> {
    Ok(compatibility::recommend(&name))
}

#[tauri::command]
pub fn run_diagnostics(
    app: AppHandle,
    app_id: String,
) -> Result<Vec<diagnostics::DiagnosticCheck>, FusionError> {
    let state = app
        .state::<FusionState>()
        .0
        .lock()
        .map_err(|_| FusionError::Unsupported)?
        .clone();
    Ok(diagnostics::run_app_diagnostics(&state, &app_id))
}

#[tauri::command]
pub fn apply_fix(app: AppHandle, fix_id: String, app_id: String) -> Result<String, FusionError> {
    let intent = FixIntent::from_id(&fix_id).ok_or(FusionError::Unsupported)?;
    match intent {
        FixIntent::InstallRuntime => {
            Ok("Install Wine:\n\n  brew install --cask --no-quarantine wine-stable\n\nThen try launching again.".into())
        }
        FixIntent::InitPrefix => {
            let st = app.state::<FusionState>();
            let bottle = st.with_state(|s| {
                s.applications
                    .iter()
                    .find(|a| a.id == app_id)
                    .and_then(|a| s.bottles.iter().find(|b| b.id == a.bottle_id))
                    .cloned()
                    .ok_or(FusionError::BottleNotFound)
            })?;
            let binary = wine_binary_for(&app, &bottle.runtime)?;
            crate::wine::prefix::init_prefix(&binary, Path::new(&bottle.path))?;
            Ok("Prefix initialized.".into())
        }
        FixIntent::InstallDependency(verb) => {
            let st = app.state::<FusionState>();
            let bottle = st.with_state(|s| {
                s.applications
                    .iter()
                    .find(|a| a.id == app_id)
                    .and_then(|a| s.bottles.iter().find(|b| b.id == a.bottle_id))
                    .cloned()
                    .ok_or(FusionError::BottleNotFound)
            })?;
            let binary = wine_binary_for(&app, &bottle.runtime)?;
            crate::wine::prefix::install_verbs(
                &binary,
                Path::new(&bottle.path),
                &[verb.to_string()],
            )?;
            Ok(format!("Installed {verb}."))
        }
        FixIntent::SwitchGraphics => {
            let st = app.state::<FusionState>();
            st.with_state(|s| {
                let app2 = s
                    .applications
                    .iter()
                    .find(|a| a.id == app_id)
                    .cloned()
                    .ok_or(FusionError::ApplicationNotFound)?;
                let b = s
                    .bottles
                    .iter_mut()
                    .find(|b| b.id == app2.bottle_id)
                    .ok_or(FusionError::BottleNotFound)?;
                b.dxvk_enabled = true;
                b.graphics = "d3dmetal".to_string();
                Ok(())
            })?;
            st.save(&app)?;
            Ok("Switched graphics to D3DMetal (Apple GPTK) for full DirectX 11/12 hardware acceleration.".into())
        }
        FixIntent::EnableMsync => {
            let st = app.state::<FusionState>();
            st.with_state(|s| {
                let app2 = s
                    .applications
                    .iter()
                    .find(|a| a.id == app_id)
                    .cloned()
                    .ok_or(FusionError::ApplicationNotFound)?;
                let b = s
                    .bottles
                    .iter_mut()
                    .find(|b| b.id == app2.bottle_id)
                    .ok_or(FusionError::BottleNotFound)?;
                b.msync_enabled = true;
                Ok(())
            })?;
            st.save(&app)?;
            Ok("Enabled MSync fast synchronization for this bottle.".into())
        }
        FixIntent::InstallRosetta => {
            Ok("Run this command in Terminal to install Apple Rosetta 2:\n\n  /usr/sbin/softwareupdate --install-rosetta --agree-to-license\n\nThen restart FusionCross.".into())
        }
    }
}
