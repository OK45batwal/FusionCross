mod commands;
mod core;
mod manager;
mod wine;

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
            commands::probe_runtime
        ])
        .run(tauri::generate_context!())
        .expect("error while running FusionCross");
}
