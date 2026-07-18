use std::path::{Component, Path, PathBuf};

use crate::error::{Error, Result};

/// Choke point de segurança: TODO caminho vindo do frontend passa por aqui.
/// Canonicaliza (resolvendo junctions/symlinks e `..`) e exige que o resultado
/// fique dentro da raiz do workspace.
pub struct PathGuard {
    root: PathBuf,
}

/// Nomes reservados do Windows — proibidos como nome de arquivo/pasta,
/// inclusive com extensão ("CON.txt" também é reservado).
const RESERVED: &[&str] = &[
    "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
    "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

impl PathGuard {
    pub fn new(root: &Path) -> std::io::Result<Self> {
        Ok(Self {
            root: dunce::canonicalize(root)?,
        })
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    /// Resolve um caminho que DEVE existir, garantindo que está dentro da raiz.
    pub fn resolve_existing(&self, raw: &str) -> Result<PathBuf> {
        if raw.trim().is_empty() {
            return Err(Error::PathInvalid("caminho vazio".into()));
        }
        let canonical = dunce::canonicalize(raw)
            .map_err(|_| Error::PathNotFound(raw.to_string()))?;
        if !canonical.starts_with(&self.root) {
            return Err(Error::PathOutsideRoot);
        }
        Ok(canonical)
    }

    /// Resolve um caminho NOVO (criação/rename): o pai deve existir dentro da
    /// raiz e o nome não pode conter separadores, `..` nem nomes reservados.
    pub fn resolve_new(&self, parent_raw: &str, leaf: &str) -> Result<PathBuf> {
        let parent = self.resolve_existing(parent_raw)?;
        if !parent.is_dir() {
            return Err(Error::PathInvalid("o destino não é uma pasta".into()));
        }
        validate_leaf(leaf)?;
        let candidate = parent.join(leaf);
        // Cinto e suspensório: mesmo com leaf validado, o join precisa continuar dentro.
        if !candidate.starts_with(&self.root) {
            return Err(Error::PathOutsideRoot);
        }
        Ok(candidate)
    }
}

fn validate_leaf(leaf: &str) -> Result<()> {
    if leaf.is_empty() || leaf.len() > 200 {
        return Err(Error::PathInvalid("nome vazio ou longo demais".into()));
    }
    // Um leaf válido é UM componente normal — sem `\`, `/`, `..`, `C:` etc.
    let path = Path::new(leaf);
    let mut components = path.components();
    let only = components.next();
    if components.next().is_some() || !matches!(only, Some(Component::Normal(_))) {
        return Err(Error::PathInvalid(format!("nome inválido: {leaf}")));
    }
    if leaf.ends_with('.') || leaf.ends_with(' ') {
        return Err(Error::PathInvalid(
            "nome não pode terminar com ponto ou espaço".into(),
        ));
    }
    if leaf.chars().any(|c| {
        matches!(c, '<' | '>' | ':' | '"' | '|' | '?' | '*') || (c as u32) < 0x20
    }) {
        return Err(Error::PathInvalid("nome com caracteres proibidos".into()));
    }
    let stem = leaf.split('.').next().unwrap_or(leaf).to_ascii_uppercase();
    if RESERVED.contains(&stem.as_str()) {
        return Err(Error::PathInvalid(format!("nome reservado do Windows: {leaf}")));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup() -> (tempfile::TempDir, PathGuard) {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir(dir.path().join("projeto")).unwrap();
        std::fs::write(dir.path().join("projeto").join("a.txt"), "x").unwrap();
        let guard = PathGuard::new(dir.path()).unwrap();
        (dir, guard)
    }

    #[test]
    fn aceita_caminho_dentro_da_raiz() {
        let (_dir, guard) = setup();
        let p = guard.root().join("projeto");
        assert!(guard.resolve_existing(p.to_str().unwrap()).is_ok());
    }

    #[test]
    fn rejeita_traversal_com_pontos() {
        let (_dir, guard) = setup();
        let evil = guard.root().join("projeto").join("..").join("..");
        let result = guard.resolve_existing(evil.to_str().unwrap());
        assert!(matches!(
            result,
            Err(Error::PathOutsideRoot) | Err(Error::PathNotFound(_))
        ));
    }

    #[test]
    fn rejeita_caminho_absoluto_fora() {
        let (_dir, guard) = setup();
        assert!(matches!(
            guard.resolve_existing("C:\\Windows\\System32"),
            Err(Error::PathOutsideRoot)
        ));
    }

    #[test]
    fn rejeita_inexistente() {
        let (_dir, guard) = setup();
        let ghost = guard.root().join("nao-existe");
        assert!(matches!(
            guard.resolve_existing(ghost.to_str().unwrap()),
            Err(Error::PathNotFound(_))
        ));
    }

    #[test]
    fn resolve_new_valida_leaf() {
        let (_dir, guard) = setup();
        let parent = guard.root().to_str().unwrap().to_string();
        assert!(guard.resolve_new(&parent, "novo.txt").is_ok());
        for bad in [
            "..",
            "a\\b",
            "a/b",
            "CON",
            "con.txt",
            "COM7",
            "fim.",
            "fim ",
            "a:b",
            "per?gunta",
            "",
        ] {
            assert!(
                guard.resolve_new(&parent, bad).is_err(),
                "deveria rejeitar leaf: {bad:?}"
            );
        }
    }

    #[test]
    fn resolve_new_exige_pai_existente_dentro_da_raiz() {
        let (_dir, guard) = setup();
        assert!(guard.resolve_new("C:\\Windows", "x.txt").is_err());
        let ghost = guard.root().join("fantasma");
        assert!(guard
            .resolve_new(ghost.to_str().unwrap(), "x.txt")
            .is_err());
    }

    #[cfg(windows)]
    #[test]
    fn rejeita_escape_por_junction() {
        let (dir, guard) = setup();
        // Junction dentro do workspace apontando para fora dele.
        let target = std::env::temp_dir();
        let junction = dir.path().join("atalho");
        let status = std::process::Command::new("cmd")
            .args([
                "/c",
                "mklink",
                "/J",
                junction.to_str().unwrap(),
                target.to_str().unwrap(),
            ])
            .status()
            .unwrap();
        assert!(status.success(), "mklink /J precisa funcionar no teste");
        // Canonicalize resolve a junction para o destino real (fora da raiz).
        let via_junction = junction.join(".");
        let result = guard.resolve_existing(via_junction.to_str().unwrap());
        assert!(
            matches!(result, Err(Error::PathOutsideRoot)),
            "junction para fora deve ser rejeitada, veio: {result:?}"
        );
    }
}
