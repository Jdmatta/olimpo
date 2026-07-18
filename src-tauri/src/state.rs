use std::path::{Path, PathBuf};

use crate::db::Db;
use crate::fs::PathGuard;
use crate::pty::PtyRegistry;

pub struct AppState {
    pub ptys: PtyRegistry,
    pub workspace_root: PathBuf,
    pub guard: PathGuard,
    pub db: Db,
}

impl AppState {
    pub fn new(app_data_dir: &Path) -> crate::error::Result<Self> {
        // v1: raiz fixa do workspace; vira configuração no Settings (M6).
        let workspace_root = fallback_workspace();
        let guard = PathGuard::new(&workspace_root)?;
        let db = Db::open(app_data_dir)?;
        Ok(Self {
            ptys: PtyRegistry::new(),
            workspace_root,
            guard,
            db,
        })
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
