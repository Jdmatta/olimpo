//! PAT do GitHub SÓ vive no Windows Credential Manager (keyring).
//! Nunca em arquivo, banco, log ou variável de ambiente.

use keyring::Entry;

use crate::error::{Error, Result};

const SERVICE: &str = "olimpo";
const ACCOUNT: &str = "github_pat";

fn entry() -> Result<Entry> {
    Entry::new(SERVICE, ACCOUNT).map_err(|e| Error::Keyring(e.to_string()))
}

pub fn set_github_pat(token: &str) -> Result<()> {
    entry()?
        .set_password(token)
        .map_err(|e| Error::Keyring(e.to_string()))
}

/// `None` = não conectado (entrada ausente — o usuário pode apagar pela UI
/// do Credential Manager a qualquer momento; nunca tratar como crash).
pub fn get_github_pat() -> Result<Option<String>> {
    match entry()?.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(Error::Keyring(e.to_string())),
    }
}

pub fn clear_github_pat() -> Result<()> {
    match entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(Error::Keyring(e.to_string())),
    }
}
