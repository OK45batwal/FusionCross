use std::sync::Arc;

mod commands;
mod compatibility;
mod core;
mod diagnostics;
mod exporter;
mod installer;
mod manager;
mod process;
mod runtime;
mod security;
mod snapshots;
mod wine;

use tauri::Manager;

/// FusionCross — Windows apps, the Mac way.
///
/// Accumulate play time back into state when a Wine session exits.
fn record_session(app: &tauri::AppHandle, rec: process::SessionRecord) {
    use tauri::Manager;
    app.state::<manager::FusionState>()
        .with_state(|s| {
            if let Some(a) = s.applications.iter_mut().find(|a| a.id == rec.app_id) {
                a.play_time_mins += rec.duration_secs.div_ceil(60);
            }
            Ok(())
        })
        .ok();
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let state = manager::FusionState::load(app.handle());
            app.manage(state);
            let handle = app.handle().clone();
            app.manage(process::ProcessManager::new(Arc::new(
                move |rec: process::SessionRecord| {
                    record_session(&handle, rec);
                },
            )));
            app.manage(manager::Jobs(Default::default()));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_state,
            commands::get_system_info,
            commands::probe_runtime,
            commands::get_templates,
            commands::get_runtimes,
            commands::create_bottle,
            commands::repair_bottle,
            commands::delete_bottle,
            commands::clone_bottle,
            commands::open_bottle_c_drive,
            commands::reveal_in_finder,
            commands::run_command_in_bottle,
            commands::update_bottle,
            commands::kill_bottle_processes,
            commands::launch_wine_tool,
            commands::install_bottle_verb,
            commands::install_gaming_essentials,
            commands::analyze_installer,
            commands::extract_installer_icon,
            commands::scan_bottle,
            commands::scan_all_bottles,
            commands::register_application,
            commands::unregister_application,
            commands::run_installer,
            commands::list_jobs,
            commands::launch_application,
            commands::stop_application,
            commands::list_running,
            commands::toggle_favorite,
            commands::get_recommendation,
            commands::run_diagnostics,
            commands::apply_fix,
            commands::create_snapshot,
            commands::restore_snapshot,
            commands::delete_snapshot,
            commands::import_runtime,
            commands::download_runtime,
            commands::remove_runtime,
            commands::set_safe_mode,
            commands::export_app_bundle,
            commands::get_game_catalog,
            commands::install_catalog_game,
            commands::update_application,
            commands::list_application_logs,
            commands::read_log_file,
            commands::set_setting,
            commands::get_settings,
            commands::open_logs_directory,
        ])
        .run(tauri::generate_context!())
        .expect("error while running FusionCross");
}
