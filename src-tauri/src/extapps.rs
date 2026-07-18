//! Apps externos: detecção de navegadores/editores instalados e lançamento.
//! Lançar SEMPRE via Command com lista de args — nunca string de shell.

use std::path::PathBuf;

use tauri::State;

use crate::db::repos;
use crate::db::ExternalApp;
use crate::error::{Error, Result};
use crate::state::AppState;

struct Known {
    label: &'static str,
    icon: &'static str,
    /// Candidatos relativos a (LOCALAPPDATA | ProgramFiles | ProgramFiles(x86)).
    candidates: &'static [&'static str],
}

const KNOWN_APPS: &[Known] = &[
    Known {
        label: "Brave",
        icon: "globe",
        candidates: &[
            "BraveSoftware\\Brave-Browser\\Application\\brave.exe",
        ],
    },
    Known {
        label: "Chrome",
        icon: "globe",
        candidates: &[
            "Google\\Chrome\\Application\\chrome.exe",
        ],
    },
    Known {
        label: "Edge",
        icon: "globe",
        candidates: &["Microsoft\\Edge\\Application\\msedge.exe"],
    },
    Known {
        label: "Firefox",
        icon: "globe",
        candidates: &["Mozilla Firefox\\firefox.exe"],
    },
    Known {
        label: "VS Code",
        icon: "code",
        candidates: &["Programs\\Microsoft VS Code\\Code.exe"],
    },
    Known {
        label: "Cursor",
        icon: "code",
        candidates: &["Programs\\cursor\\Cursor.exe"],
    },
    Known {
        label: "Zed",
        icon: "code",
        candidates: &["Programs\\Zed\\zed.exe", "Zed\\zed.exe"],
    },
];

fn search_dirs() -> Vec<PathBuf> {
    ["LOCALAPPDATA", "ProgramFiles", "ProgramFiles(x86)"]
        .iter()
        .filter_map(|var| std::env::var_os(var).map(PathBuf::from))
        .collect()
}

fn find_known() -> Vec<(&'static str, &'static str, PathBuf)> {
    let dirs = search_dirs();
    let mut found = Vec::new();
    for app in KNOWN_APPS {
        'outer: for candidate in app.candidates {
            for dir in &dirs {
                let full = dir.join(candidate);
                if full.is_file() {
                    found.push((app.label, app.icon, full));
                    break 'outer;
                }
            }
        }
    }
    found
}

/// Semeia a tabela na primeira execução com o que estiver instalado.
pub fn seed_if_empty(state: &AppState) {
    let _ = state.db.with(|c| {
        if repos::extapp_count(c)? > 0 {
            return Ok(());
        }
        for (label, icon, path) in find_known() {
            let _ = repos::extapp_add(c, label, &path.to_string_lossy(), "", icon);
        }
        Ok(())
    });
}

#[tauri::command]
pub fn extapp_list(state: State<'_, AppState>) -> Result<Vec<ExternalApp>> {
    state.db.with(repos::extapp_list)
}

#[tauri::command]
pub fn extapp_add(
    state: State<'_, AppState>,
    label: String,
    command: String,
    args: String,
    icon: String,
) -> Result<ExternalApp> {
    state
        .db
        .with(|c| repos::extapp_add(c, &label, &command, &args, &icon))
}

#[tauri::command]
pub fn extapp_delete(state: State<'_, AppState>, id: i64) -> Result<()> {
    state.db.with(|c| repos::extapp_delete(c, id))
}

/// Redetecta apps conhecidos que ainda não estão cadastrados (pelo comando).
#[tauri::command]
pub fn extapp_detect(state: State<'_, AppState>) -> Result<Vec<ExternalApp>> {
    state.db.with(|c| {
        let existing: Vec<String> = repos::extapp_list(c)?
            .into_iter()
            .map(|a| a.command.to_lowercase())
            .collect();
        for (label, icon, path) in find_known() {
            let cmd = path.to_string_lossy().to_string();
            if !existing.contains(&cmd.to_lowercase()) {
                let _ = repos::extapp_add(c, label, &cmd, "", icon);
            }
        }
        repos::extapp_list(c)
    })
}

#[tauri::command]
pub fn extapp_launch(state: State<'_, AppState>, id: i64) -> Result<()> {
    let app = state.db.with(|c| repos::extapp_get(c, id))?;
    let path = std::path::Path::new(&app.command);
    if !path.is_file() {
        return Err(Error::PathNotFound(app.command));
    }
    let args: Vec<&str> = app.args.split_whitespace().collect();
    std::process::Command::new(path)
        .args(args)
        .spawn()
        .map_err(Error::Io)?;
    Ok(())
}
