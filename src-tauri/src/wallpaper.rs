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
const MAX_WALLPAPER_BYTES: u64 = 30 * 1024 * 1024;

/// Importa uma imagem escolhida pelo usuário (via dialog nativo) copiando-a
/// para a pasta de wallpapers. Valida extensão e tamanho; nome sanitizado.
#[tauri::command]
pub fn wallpaper_import(state: State<'_, AppState>, source: String) -> Result<String> {
    use crate::error::Error;

    let src = std::path::PathBuf::from(&source);
    if !src.is_file() {
        return Err(Error::PathNotFound(source));
    }
    let ext = src
        .extension()
        .map(|e| e.to_string_lossy().to_ascii_lowercase())
        .unwrap_or_default();
    if !EXTENSIONS.contains(&ext.as_str()) {
        return Err(Error::InvalidInput("só .jpg, .png ou .webp".into()));
    }
    let size = std::fs::metadata(&src)?.len();
    if size > MAX_WALLPAPER_BYTES {
        return Err(Error::InvalidInput("imagem acima de 30 MB".into()));
    }
    let stem = src
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| "wallpaper".into());
    // Nome seguro: só alfanumérico, hífen e underscore.
    let safe: String = stem
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '-' })
        .take(60)
        .collect();
    let mut name = format!("{safe}.{ext}");
    let mut n = 2;
    while state.wallpapers_dir.join(&name).exists() {
        name = format!("{safe}-{n}.{ext}");
        n += 1;
    }
    std::fs::copy(&src, state.wallpapers_dir.join(&name))?;
    Ok(name)
}

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
