use serde::Serialize;
use tauri::State;

use crate::error::Result;
use crate::state::AppState;

#[derive(Serialize)]
pub struct WallpaperInfo {
    pub dir: String,
    pub files: Vec<String>,
}

const EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "webp"];

/// Lista as imagens da pasta de wallpapers do usuário (%APPDATA%/…/wallpapers).
#[tauri::command]
pub fn wallpaper_list(state: State<'_, AppState>) -> Result<WallpaperInfo> {
    let dir = &state.wallpapers_dir;
    let mut files: Vec<String> = std::fs::read_dir(dir)?
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().into_owned();
            let ext = name.rsplit('.').next()?.to_ascii_lowercase();
            (e.path().is_file() && EXTENSIONS.contains(&ext.as_str())).then_some(name)
        })
        .collect();
    files.sort();
    Ok(WallpaperInfo {
        dir: dir.to_string_lossy().into_owned(),
        files,
    })
}
