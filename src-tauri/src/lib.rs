mod app_control;
mod db;
mod error;
mod extapps;
mod fs;
mod github;
mod pty;
mod secrets;
mod state;
mod wallpaper;

use tauri::Manager;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            let state = AppState::new(&data_dir)?;
            extapps::seed_if_empty(&state);
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            pty::commands::pty_spawn,
            pty::commands::pty_write,
            pty::commands::pty_resize,
            pty::commands::pty_kill,
            fs::commands::fs_roots,
            fs::commands::fs_list,
            fs::commands::fs_create_dir,
            fs::commands::fs_create_file,
            fs::commands::fs_rename,
            fs::commands::fs_move,
            fs::commands::fs_delete,
            fs::commands::fs_open_in_vscode,
            fs::commands::fs_reveal_in_explorer,
            db::commands::settings_get,
            db::commands::settings_set,
            db::commands::todo_list,
            db::commands::todo_add,
            db::commands::todo_toggle,
            db::commands::todo_delete,
            db::commands::todo_reorder,
            db::commands::todo_carry_over,
            db::commands::pomodoro_start,
            db::commands::pomodoro_finish,
            db::commands::pomodoro_open_session,
            db::commands::pomodoro_history,
            db::commands::layout_save,
            db::commands::layout_all,
            db::commands::quicklink_add,
            db::commands::quicklink_list,
            db::commands::quicklink_delete,
            github::commands::github_status,
            github::commands::github_connect,
            github::commands::github_disconnect,
            github::commands::github_overview,
            github::commands::github_assigned,
            github::commands::github_commits,
            wallpaper::wallpaper_list,
            wallpaper::wallpaper_import,
            extapps::extapp_list,
            extapps::extapp_add,
            extapps::extapp_delete,
            extapps::extapp_detect,
            extapps::extapp_launch,
            app_control::app_quit,
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
