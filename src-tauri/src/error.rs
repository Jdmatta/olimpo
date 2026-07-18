use serde::Serialize;

/// Erro unificado dos comandos — serializa como { code, message } para o frontend.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("sessão de terminal não encontrada: {0}")]
    PtyNotFound(u32),
    #[error("falha no pty: {0}")]
    Pty(String),
    #[error("caminho fora do workspace")]
    PathOutsideRoot,
    #[error("caminho inválido: {0}")]
    PathInvalid(String),
    #[error("caminho não existe: {0}")]
    PathNotFound(String),
    #[error("falha ao mover para a Lixeira: {0}")]
    Trash(String),
    #[error("erro de banco: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("registro não encontrado")]
    NotFound,
    #[error("entrada inválida: {0}")]
    InvalidInput(String),
    #[error("erro de IO: {0}")]
    Io(#[from] std::io::Error),
}

impl Error {
    fn code(&self) -> &'static str {
        match self {
            Error::PtyNotFound(_) => "pty_not_found",
            Error::Pty(_) => "pty",
            Error::PathOutsideRoot => "path_outside_root",
            Error::PathInvalid(_) => "path_invalid",
            Error::PathNotFound(_) => "path_not_found",
            Error::Trash(_) => "trash",
            Error::Db(_) => "db",
            Error::NotFound => "not_found",
            Error::InvalidInput(_) => "invalid_input",
            Error::Io(_) => "io",
        }
    }
}

impl Serialize for Error {
    fn serialize<S: serde::Serializer>(
        &self,
        serializer: S,
    ) -> std::result::Result<S::Ok, S::Error> {
        use serde::ser::SerializeStruct;
        let mut s = serializer.serialize_struct("Error", 2)?;
        s.serialize_field("code", self.code())?;
        s.serialize_field("message", &self.to_string())?;
        s.end()
    }
}

pub type Result<T> = std::result::Result<T, Error>;
