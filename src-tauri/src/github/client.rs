use serde::de::DeserializeOwned;

use crate::error::{Error, Result};

const API: &str = "https://api.github.com";

pub struct GithubClient {
    http: reqwest::Client,
}

pub struct ApiResponse<T> {
    pub data: T,
    pub rate_remaining: Option<u32>,
}

impl GithubClient {
    pub fn new() -> Self {
        Self {
            http: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(15))
                .build()
                .expect("reqwest client"),
        }
    }

    /// GET autenticado. O token entra só no header — nunca em URL ou log.
    pub async fn get<T: DeserializeOwned>(
        &self,
        path: &str,
        token: &str,
    ) -> Result<ApiResponse<T>> {
        let response = self
            .http
            .get(format!("{API}{path}"))
            .header("Authorization", format!("Bearer {token}"))
            .header("User-Agent", "olimpo-app")
            .header("Accept", "application/vnd.github+json")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .send()
            .await
            .map_err(|e| Error::Network(sanitize(&e.to_string())))?;

        let rate_remaining = response
            .headers()
            .get("x-ratelimit-remaining")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.parse().ok());

        let status = response.status();
        if status == reqwest::StatusCode::UNAUTHORIZED {
            return Err(Error::GithubAuth);
        }
        if status == reqwest::StatusCode::FORBIDDEN && rate_remaining == Some(0) {
            return Err(Error::GithubRate);
        }
        if !status.is_success() {
            return Err(Error::Github(format!("GitHub respondeu {status}")));
        }

        let data = response
            .json::<T>()
            .await
            .map_err(|e| Error::Github(sanitize(&e.to_string())))?;
        Ok(ApiResponse {
            data,
            rate_remaining,
        })
    }
}

/// Nunca deixar um token vazar em mensagem de erro.
fn sanitize(msg: &str) -> String {
    let mut out = msg.to_string();
    for marker in ["ghp_", "github_pat_"] {
        if let Some(idx) = out.find(marker) {
            out.truncate(idx);
            out.push_str("[token removido]");
        }
    }
    out
}

/// `owner/repo` estrito — vai direto na URL da API.
pub fn validate_full_name(full_name: &str) -> Result<()> {
    let mut parts = full_name.split('/');
    let (Some(owner), Some(repo), None) = (parts.next(), parts.next(), parts.next()) else {
        return Err(Error::InvalidInput("formato esperado: owner/repo".into()));
    };
    let ok = |s: &str| {
        !s.is_empty()
            && s != "."
            && s != ".."
            && s.len() <= 100
            && s.chars()
                .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
    };
    if !ok(owner) || !ok(repo) {
        return Err(Error::InvalidInput("owner/repo com caracteres inválidos".into()));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn full_name_valido_e_invalidos() {
        assert!(validate_full_name("Jdmatta/olimpo").is_ok());
        assert!(validate_full_name("a-b_c.d/e.f-g_h").is_ok());
        for bad in [
            "",
            "semrepo",
            "a/b/c",
            "../etc",
            "a/b?x=1",
            "a b/c",
            "a/b#",
            "ow ner/repo",
        ] {
            assert!(validate_full_name(bad).is_err(), "deveria rejeitar {bad:?}");
        }
    }

    #[test]
    fn sanitize_corta_tokens() {
        let msg = "erro com ghp_abc123segredo no meio";
        let clean = sanitize(msg);
        assert!(!clean.contains("ghp_abc123"));
        assert!(clean.contains("[token removido]"));
    }
}
