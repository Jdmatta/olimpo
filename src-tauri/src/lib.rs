mod error;
mod fs;
mod pty;
mod state;

use tauri::Manager;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .setup(|app| {
            app.manage(AppState::new());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            pty::commands::pty_spawn,
            pty::commands::pty_write,
            pty::commands::pty_resize,
            pty::commands::pty_kill,
            fs::commands::fs_list,
            fs::commands::fs_create_dir,
            fs::commands::fs_create_file,
            fs::commands::fs_rename,
            fs::commands::fs_move,
            fs::commands::fs_delete,
            fs::commands::fs_open_in_vscode,
            fs::commands::fs_reveal_in_explorer,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // Encerramento: mata todas as sessões de pty para não vazar conhost.
            if let tauri::RunEvent::Exit = event {
                if let Some(state) = app.try_state::<AppState>() {
                    state.ptys.kill_all();
                }
            }
        });
}
