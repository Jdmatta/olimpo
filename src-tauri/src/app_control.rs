use tauri::AppHandle;

/// Encerramento confiável: window.close() depende de permission e do fluxo
/// de eventos do WebView; app.exit passa por RunEvent::Exit (mata os ptys).
#[tauri::command]
pub fn app_quit(app: AppHandle) {
    app.exit(0);
}
