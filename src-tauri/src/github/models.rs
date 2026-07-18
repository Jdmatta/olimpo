//! DTOs mínimos da API do GitHub — só os campos que a UI usa.
//! serde ignora campos extras, então novos campos da API não quebram nada.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GhUser {
    pub login: String,
    pub name: Option<String>,
    pub avatar_url: String,
    pub html_url: String,
    pub public_repos: u32,
    pub followers: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GhRepo {
    pub id: u64,
    pub name: String,
    pub full_name: String,
    pub html_url: String,
    pub description: Option<String>,
    pub language: Option<String>,
    pub stargazers_count: u32,
    pub pushed_at: Option<String>,
    pub private: bool,
}

/// Item do /search/issues — cobre issues E pull requests
/// (`pull_request` presente = é PR).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GhIssueItem {
    pub id: u64,
    pub number: u64,
    pub title: String,
    pub html_url: String,
    pub state: String,
    pub repository_url: String,
    #[serde(default)]
    pub pull_request: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GhSearchIssues {
    pub total_count: u64,
    pub items: Vec<GhIssueItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GhCommitInfo {
    pub message: String,
    pub author: Option<GhCommitAuthor>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GhCommitAuthor {
    pub name: Option<String>,
    pub date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GhCommit {
    pub sha: String,
    pub html_url: String,
    pub commit: GhCommitInfo,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn user_deserializa_fixture() {
        let json = r#"{
            "login": "Jdmatta", "id": 1, "name": "Jairo da Matta",
            "avatar_url": "https://avatars.githubusercontent.com/u/1",
            "html_url": "https://github.com/Jdmatta",
            "public_repos": 5, "followers": 3,
            "campo_novo_que_nao_conhecemos": true
        }"#;
        let user: GhUser = serde_json::from_str(json).unwrap();
        assert_eq!(user.login, "Jdmatta");
        assert_eq!(user.followers, 3);
    }

    #[test]
    fn repo_com_nulls_deserializa() {
        let json = r#"{
            "id": 10, "name": "olimpo", "full_name": "Jdmatta/olimpo",
            "html_url": "https://github.com/Jdmatta/olimpo",
            "description": null, "language": null,
            "stargazers_count": 0, "pushed_at": null, "private": true
        }"#;
        let repo: GhRepo = serde_json::from_str(json).unwrap();
        assert!(repo.private);
        assert!(repo.language.is_none());
    }

    #[test]
    fn search_distingue_issue_de_pr() {
        let json = r#"{
            "total_count": 2,
            "items": [
                {"id":1,"number":7,"title":"bug","html_url":"u","state":"open",
                 "repository_url":"https://api.github.com/repos/Jdmatta/olimpo"},
                {"id":2,"number":8,"title":"feat","html_url":"u","state":"open",
                 "repository_url":"https://api.github.com/repos/Jdmatta/olimpo",
                 "pull_request": {"url": "x"}}
            ]
        }"#;
        let search: GhSearchIssues = serde_json::from_str(json).unwrap();
        assert!(search.items[0].pull_request.is_none());
        assert!(search.items[1].pull_request.is_some());
    }

    #[test]
    fn commit_deserializa() {
        let json = r#"{
            "sha": "abc123", "html_url": "u",
            "commit": {"message": "Cria scaffold", "author": {"name": "Jairo", "date": "2026-07-17T00:00:00Z"}}
        }"#;
        let c: GhCommit = serde_json::from_str(json).unwrap();
        assert_eq!(c.commit.message, "Cria scaffold");
    }
}
