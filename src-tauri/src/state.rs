use std::path::{Path, PathBuf};
use std::time::Duration;

use crate::db::Db;
use crate::fs::PathGuard;
use crate::github::{GithubClient, TtlCache};
use crate::pty::PtyRegistry;

pub struct AppState {
    pub ptys: PtyRegistry,
    pub workspace_root: PathBuf,
    pub guard: PathGuard,
    pub db: Db,
    pub github: GithubClient,
    pub github_cache: TtlCache,
    pub wallpapers_dir: PathBuf,
}

impl AppState {
    pub fn new(app_data_dir: &Path) -> crate::error::Result<Self> {
        let workspace_root = fallback_workspace();
        // Raízes navegáveis no app Arquivos: workspace primeiro (principal),
        // depois pastas pessoais úteis. Inexistentes são ignoradas pelo guard.
        let home = std::env::var_os("USERPROFILE")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("C:\\"));
        let roots = vec![
            workspace_root.clone(),
            home.join("Documents"),
            home.join("Downloads"),
            home.join(".claude"),
        ];
        let guard = PathGuard::new(&roots)?;
        let db = Db::open(app_data_dir)?;
        let wallpapers_dir = app_data_dir.join("wallpapers");
        std::fs::create_dir_all(&wallpapers_dir)?;
        Ok(Self {
            ptys: PtyRegistry::new(),
            workspace_root,
            guard,
            db,
            github: GithubClient::new(),
            github_cache: TtlCache::new(Duration::from_secs(300)),
            wallpapers_dir,
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
