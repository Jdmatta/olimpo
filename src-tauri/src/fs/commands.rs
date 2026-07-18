use std::path::Path;
use std::time::UNIX_EPOCH;

use serde::Serialize;
use tauri::State;

use crate::error::{Error, Result};
use crate::state::AppState;

#[derive(Serialize)]
pub struct FsEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified_ms: u64,
}

#[derive(Serialize)]
pub struct FsListing {
    pub path: String,
    pub entries: Vec<FsEntry>,
}

#[derive(Serialize)]
pub struct FsRoot {
    pub label: String,
    pub path: String,
}

/// Raízes navegáveis (sidebar do app Arquivos).
#[tauri::command]
pub fn fs_roots(state: State<'_, AppState>) -> Vec<FsRoot> {
    state
        .guard
        .roots()
        .iter()
        .map(|root| {
            let label = if root == state.guard.root() {
                "Workspace".to_string()
            } else {
                root.file_name()
                    .map(|n| n.to_string_lossy().into_owned())
                    .unwrap_or_else(|| root.to_string_lossy().into_owned())
            };
            FsRoot {
                label,
                path: root.to_string_lossy().into_owned(),
            }
        })
        .collect()
}

fn to_entry(path: &Path) -> Option<FsEntry> {
    let meta = std::fs::metadata(path).ok()?;
    let modified_ms = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    Some(FsEntry {
        name: path.file_name()?.to_string_lossy().into_owned(),
        path: path.to_string_lossy().into_owned(),
        is_dir: meta.is_dir(),
        size: meta.len(),
        modified_ms,
    })
}

/// Lista uma pasta do workspace. `path` ausente = raiz.
#[tauri::command]
pub fn fs_list(state: State<'_, AppState>, path: Option<String>) -> Result<FsListing> {
    let dir = match path {
        Some(p) => state.guard.resolve_existing(&p)?,
        None => state.guard.root().to_path_buf(),
    };
    if !dir.is_dir() {
        return Err(Error::PathInvalid("não é uma pasta".into()));
    }
    let mut entries: Vec<FsEntry> = std::fs::read_dir(&dir)?
        .filter_map(|e| e.ok())
        .filter_map(|e| to_entry(&e.path()))
        .collect();
    // Pastas primeiro, depois nome (case-insensitive) — padrão de explorer.
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(FsListing {
        path: dir.to_string_lossy().into_owned(),
        entries,
    })
}

#[tauri::command]
pub fn fs_create_dir(state: State<'_, AppState>, parent: String, name: String) -> Result<FsEntry> {
    let target = state.guard.resolve_new(&parent, &name)?;
    std::fs::create_dir(&target)?;
    to_entry(&target).ok_or(Error::PathNotFound(name))
}

#[tauri::command]
pub fn fs_create_file(state: State<'_, AppState>, parent: String, name: String) -> Result<FsEntry> {
    let target = state.guard.resolve_new(&parent, &name)?;
    if target.exists() {
        return Err(Error::PathInvalid("já existe um item com esse nome".into()));
    }
    std::fs::File::create(&target)?;
    to_entry(&target).ok_or(Error::PathNotFound(name))
}

#[tauri::command]
pub fn fs_rename(state: State<'_, AppState>, path: String, new_name: String) -> Result<FsEntry> {
    let source = state.guard.resolve_existing(&path)?;
    if state.guard.is_root(&source) {
        return Err(Error::PathInvalid("não dá para renomear a raiz".into()));
    }
    let parent = source
        .parent()
        .ok_or_else(|| Error::PathInvalid("sem pasta pai".into()))?
        .to_string_lossy()
        .into_owned();
    let target = state.guard.resolve_new(&parent, &new_name)?;
    if target.exists() {
        return Err(Error::PathInvalid("já existe um item com esse nome".into()));
    }
    std::fs::rename(&source, &target)?;
    to_entry(&target).ok_or(Error::PathNotFound(new_name))
}

#[tauri::command]
pub fn fs_move(state: State<'_, AppState>, path: String, target_dir: String) -> Result<FsEntry> {
    let source = state.guard.resolve_existing(&path)?;
    if state.guard.is_root(&source) {
        return Err(Error::PathInvalid("não dá para mover a raiz".into()));
    }
    let name = source
        .file_name()
        .ok_or_else(|| Error::PathInvalid("sem nome".into()))?
        .to_string_lossy()
        .into_owned();
    let target = state.guard.resolve_new(&target_dir, &name)?;
    if target == source {
        return to_entry(&source).ok_or(Error::PathNotFound(name));
    }
    if target.exists() {
        return Err(Error::PathInvalid("já existe um item com esse nome no destino".into()));
    }
    // Mover para dentro de si mesmo criaria um loop.
    if source.is_dir() && target.starts_with(&source) {
        return Err(Error::PathInvalid("não dá para mover uma pasta para dentro dela".into()));
    }
    std::fs::rename(&source, &target)?;
    to_entry(&target).ok_or(Error::PathNotFound(name))
}

/// Delete SEMPRE via Lixeira — nunca remoção permanente (regra do projeto).
#[tauri::command]
pub fn fs_delete(state: State<'_, AppState>, path: String) -> Result<()> {
    let target = state.guard.resolve_existing(&path)?;
    if state.guard.is_root(&target) {
        return Err(Error::PathInvalid("não dá para deletar a raiz".into()));
    }
    trash::delete(&target).map_err(|e| Error::Trash(e.to_string()))
}

/// Abre no VS Code — Command com lista de args, nunca shell string.
#[tauri::command]
pub fn fs_open_in_vscode(state: State<'_, AppState>, path: String) -> Result<()> {
    let target = state.guard.resolve_existing(&path)?;
    let code = resolve_vscode_cli()
        .ok_or_else(|| Error::PathInvalid("VS Code não encontrado".into()))?;
    std::process::Command::new(code)
        .arg(target)
        .spawn()
        .map_err(Error::Io)?;
    Ok(())
}

#[tauri::command]
pub fn fs_reveal_in_explorer(state: State<'_, AppState>, path: String) -> Result<()> {
    let target = state.guard.resolve_existing(&path)?;
    // explorer.exe /select, <path> — abre a pasta com o item selecionado.
    std::process::Command::new("explorer.exe")
        .arg("/select,")
        .arg(target)
        .spawn()
        .map_err(Error::Io)?;
    Ok(())
}

fn resolve_vscode_cli() -> Option<std::path::PathBuf> {
    let local = std::env::var_os("LOCALAPPDATA")?;
    let per_user = std::path::PathBuf::from(&local)
        .join("Programs")
        .join("Microsoft VS Code")
        .join("bin")
        .join("code.cmd");
    if per_user.exists() {
        return Some(per_user);
    }
    let program_files = std::env::var_os("ProgramFiles")?;
    let system_wide = std::path::PathBuf::from(program_files)
        .join("Microsoft VS Code")
        .join("bin")
        .join("code.cmd");
    system_wide.exists().then_some(system_wide)
}
