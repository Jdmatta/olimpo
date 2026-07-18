use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::repos;
use crate::error::{Error, Result};
use crate::github::client::validate_full_name;
use crate::github::models::{GhCommit, GhRepo, GhSearchIssues, GhUser};
use crate::secrets;
use crate::state::AppState;

#[derive(Serialize)]
pub struct GithubStatus {
    pub connected: bool,
    pub login: Option<String>,
}

fn require_token() -> Result<String> {
    secrets::get_github_pat()?.ok_or(Error::GithubAuth)
}

/// Estado da conexão — barato, sem rede.
#[tauri::command]
pub fn github_status(state: State<'_, AppState>) -> Result<GithubStatus> {
    let connected = secrets::get_github_pat()?.is_some();
    let login = state.db.with(|c| repos::settings_get(c, "github_login"))?;
    Ok(GithubStatus {
        connected,
        login: if connected { login } else { None },
    })
}

/// Valida o PAT via /user e só então guarda no Credential Manager.
/// O token passa pelo IPC uma única vez e nunca é ecoado de volta.
#[tauri::command]
pub async fn github_connect(state: State<'_, AppState>, token: String) -> Result<GhUser> {
    let token = token.trim().to_string();
    if token.is_empty() || token.len() > 400 {
        return Err(Error::InvalidInput("token vazio ou longo demais".into()));
    }
    let response = state.github.get::<GhUser>("/user", &token).await?;
    secrets::set_github_pat(&token)?;
    state
        .db
        .with(|c| repos::settings_set(c, "github_login", &response.data.login))?;
    state.github_cache.clear();
    Ok(response.data)
}

#[tauri::command]
pub fn github_disconnect(state: State<'_, AppState>) -> Result<()> {
    secrets::clear_github_pat()?;
    state.db.with(|c| repos::settings_set(c, "github_login", ""))?;
    state.github_cache.clear();
    Ok(())
}

#[derive(Serialize, Deserialize)]
pub struct GithubOverview {
    pub user: GhUser,
    pub repos: Vec<GhRepo>,
    pub rate_remaining: Option<u32>,
}

#[tauri::command]
pub async fn github_overview(state: State<'_, AppState>, force: bool) -> Result<GithubOverview> {
    const KEY: &str = "overview";
    if !force {
        if let Some(cached) = state.github_cache.get(KEY) {
            if let Ok(hit) = serde_json::from_value::<GithubOverview>(cached) {
                return Ok(hit);
            }
        }
    }
    let token = require_token()?;
    let user = state.github.get::<GhUser>("/user", &token).await?;
    let repos = state
        .github
        .get::<Vec<GhRepo>>("/user/repos?sort=pushed&per_page=30", &token)
        .await?;
    let overview = GithubOverview {
        user: user.data,
        repos: repos.data,
        rate_remaining: repos.rate_remaining,
    };
    if let Ok(value) = serde_json::to_value(&overview) {
        state.github_cache.put(KEY, value);
    }
    Ok(overview)
}

#[tauri::command]
pub async fn github_assigned(state: State<'_, AppState>, force: bool) -> Result<GhSearchIssues> {
    const KEY: &str = "assigned";
    if !force {
        if let Some(cached) = state.github_cache.get(KEY) {
            if let Ok(hit) = serde_json::from_value::<GhSearchIssues>(cached) {
                return Ok(hit);
            }
        }
    }
    let token = require_token()?;
    let result = state
        .github
        .get::<GhSearchIssues>(
            "/search/issues?q=assignee%3A%40me+is%3Aopen&per_page=30",
            &token,
        )
        .await?;
    if let Ok(value) = serde_json::to_value(&result.data) {
        state.github_cache.put(KEY, value);
    }
    Ok(result.data)
}

#[tauri::command]
pub async fn github_commits(
    state: State<'_, AppState>,
    full_name: String,
    force: bool,
) -> Result<Vec<GhCommit>> {
    validate_full_name(&full_name)?;
    let key = format!("commits:{full_name}");
    if !force {
        if let Some(cached) = state.github_cache.get(&key) {
            if let Ok(hit) = serde_json::from_value::<Vec<GhCommit>>(cached) {
                return Ok(hit);
            }
        }
    }
    let token = require_token()?;
    let result = state
        .github
        .get::<Vec<GhCommit>>(&format!("/repos/{full_name}/commits?per_page=20"), &token)
        .await?;
    if let Ok(value) = serde_json::to_value(&result.data) {
        state.github_cache.put(&key, value);
    }
    Ok(result.data)
}
