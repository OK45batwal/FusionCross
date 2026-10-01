#![allow(dead_code)]

use std::path::Path;
use tauri::{AppHandle, Manager};

use crate::core::errors::FusionError;
use crate::core::ids::new_id;
use crate::core::state::Snapshot;
use crate::manager::{dirs, FusionState};

use super::now_ts;

#[tauri::command]
pub fn create_snapshot(
    app: AppHandle,
    bottle_id: String,
    name: String,
) -> Result<Snapshot, FusionError> {
    let d = dirs(&app);
    let st = app.state::<FusionState>();
    let bottle = st.with_state(|s| {
        s.bottles
            .iter()
            .find(|b| b.id == bottle_id)
            .cloned()
            .ok_or(FusionError::BottleNotFound)
    })?;
    let (archive_path, size) =
        crate::snapshots::create_snapshot(&d.bottles, &d.snapshots, &bottle)?;
    let snapshot = Snapshot {
        id: new_id(),
        bottle_id,
        name,
        path: archive_path,
        size_bytes: size,
        created_at: now_ts(),
    };
    st.with_state(|s| {
        s.snapshots.push(snapshot.clone());
        Ok(())
    })?;
    st.save(&app)?;
    Ok(snapshot)
}

#[tauri::command]
pub fn restore_snapshot(app: AppHandle, snapshot_id: String) -> Result<(), FusionError> {
    let d = dirs(&app);
    let st = app.state::<FusionState>();
    let (bottle, snap) = st.with_state(|s| {
        let snap = s
            .snapshots
            .iter()
            .find(|x| x.id == snapshot_id)
            .cloned()
            .ok_or(FusionError::Unsupported)?;
        let b = s
            .bottles
            .iter()
            .find(|b| b.id == snap.bottle_id)
            .cloned()
            .ok_or(FusionError::BottleNotFound)?;
        Ok((b, snap))
    })?;
    crate::snapshots::restore_snapshot(&d.snapshots, Path::new(&snap.path), &bottle)?;
    Ok(())
}

#[tauri::command]
pub fn delete_snapshot(app: AppHandle, snapshot_id: String) -> Result<(), FusionError> {
    let d = dirs(&app);
    let st = app.state::<FusionState>();
    let snap = st.with_state(|s| {
        s.snapshots
            .iter()
            .find(|x| x.id == snapshot_id)
            .cloned()
            .ok_or(FusionError::Unsupported)
    })?;
    crate::snapshots::delete_snapshot(&d.snapshots, Path::new(&snap.path))?;
    st.with_state(|s| {
        s.snapshots.retain(|x| x.id != snapshot_id);
        Ok(())
    })?;
    st.save(&app)?;
    Ok(())
}
