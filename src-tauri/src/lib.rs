mod commands;
mod core;
mod manager;
mod wine;
mod compatibility;
mod diagnostics;
mod installer;
mod process;
mod runtime;
mod snapshots;
mod security;

use tauri::Manager;

/// FusionCross — Windows apps, the Mac way.
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let state = manager::FusionState::load(app.handle());
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_state,
            commands::get_system_info,
            commands::probe_runtime,
            commands::get_templates,
            commands::create_bottle,
            commands::delete_bottle,
            commands::clone_bottle,
            commands::update_bottle,
            commands::analyze_installer,
            commands::scan_bottle,
            commands::register_application,
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
            commands::remove_runtime,
            commands::set_safe_mode,
        ])
        .run(tauri::generate_context!())
        .expect("error while running FusionCross");
}