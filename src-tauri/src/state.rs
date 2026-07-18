use std::path::PathBuf;

use crate::fs::PathGuard;
use crate::pty::PtyRegistry;

pub struct AppState {
    pub ptys: PtyRegistry,
    pub workspace_root: PathBuf,
    pub guard: PathGuard,
}

impl AppState {
    pub fn new() -> Self {
        // v1: raiz fixa do workspace; vira configuração no Settings (M6).
        let workspace_root = fallback_workspace();
        let guard = PathGuard::new(&workspace_root)
            .expect("raiz do workspace precisa existir para o guard");
        Self {
            ptys: PtyRegistry::new(),
            workspace_root,
            guard,
        }
    }
}

fn fallback_workspace() -> PathBuf {
    let home = std::env::var_os("USERPROFILE")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("C:\\"));
    let candidate = home.join("Documents").join("Trabalhos Programacao");
    if candidate.is_dir() {
        candidate
    } else {
        home
    }
}
