use std::path::PathBuf;

use tauri::State;
use tauri::ipc::{Channel, InvokeResponseBody};

use crate::error::{Error, Result};
use crate::pty::session::SpawnSpec;
use crate::state::AppState;

/// Perfis de shell suportados. Mapeamento fixo — nunca string vinda da UI vira comando.
fn profile_command(profile: &str) -> Result<(&'static str, &'static [&'static str])> {
    match profile {
        "pwsh" => Ok(("pwsh.exe", &["-NoLogo"])),
        "powershell" => Ok(("powershell.exe", &["-NoLogo"])),
        "cmd" => Ok(("cmd.exe", &[])),
        other => Err(Error::Pty(format!("perfil desconhecido: {other}"))),
    }
}

// Todos async: comandos síncronos rodam na MAIN thread do Tauri e uma
// escrita bloqueada no pipe do ConPTY congelaria a UI inteira.
#[tauri::command]
pub async fn pty_spawn(
    state: State<'_, AppState>,
    profile: String,
    cols: u16,
    rows: u16,
    cwd: Option<String>,
    on_data: Channel<InvokeResponseBody>,
) -> Result<u32> {
    let (program, args) = profile_command(&profile)?;

    let cwd_path = match cwd {
        Some(dir) => {
            let p = PathBuf::from(dir);
            if !p.is_dir() {
                return Err(Error::Pty("diretório inicial inexistente".into()));
            }
            p
        }
        None => state.workspace_root.clone(),
    };

    let cols = cols.clamp(2, 500);
    let rows = rows.clamp(2, 300);

    state.ptys.spawn(
        SpawnSpec {
            program,
            args,
            cwd: &cwd_path,
            cols,
            rows,
        },
        std::sync::Arc::new(move |chunk| {
            let msg = match chunk {
                Some(bytes) => InvokeResponseBody::Raw(bytes),
                None => InvokeResponseBody::Json(r#"{"type":"exit"}"#.into()),
            };
            let _ = on_data.send(msg);
        }),
    )
}

#[tauri::command]
pub async fn pty_write(state: State<'_, AppState>, id: u32, data: String) -> Result<()> {
    state.ptys.write(id, data.as_bytes())
}

#[tauri::command]
pub async fn pty_resize(
    state: State<'_, AppState>,
    id: u32,
    cols: u16,
    rows: u16,
) -> Result<()> {
    state.ptys.resize(id, cols.clamp(2, 500), rows.clamp(2, 300))
}

#[tauri::command]
pub async fn pty_kill(state: State<'_, AppState>, id: u32) -> Result<()> {
    state.ptys.kill(id)
}
