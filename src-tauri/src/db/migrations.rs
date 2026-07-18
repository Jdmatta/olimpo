use rusqlite::Connection;

use crate::error::Result;

/// Migrations em ordem; índice = versão-1. Rodadas via PRAGMA user_version.
/// NUNCA editar uma migration já commitada — sempre adicionar nova.
const MIGRATIONS: &[&str] = &[
    // v1 — schema inicial
    "
    CREATE TABLE settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
    ) STRICT;

    CREATE TABLE todos (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        title        TEXT    NOT NULL,
        done         INTEGER NOT NULL DEFAULT 0,
        day          TEXT    NOT NULL,
        sort_order   INTEGER NOT NULL,
        created_at   INTEGER NOT NULL,
        completed_at INTEGER
    ) STRICT;
    CREATE INDEX idx_todos_day ON todos(day, sort_order);

    CREATE TABLE pomodoro_sessions (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        kind        TEXT    NOT NULL,
        planned_min INTEGER NOT NULL,
        started_at  INTEGER NOT NULL,
        ended_at    INTEGER,
        completed   INTEGER NOT NULL DEFAULT 0,
        todo_id     INTEGER REFERENCES todos(id) ON DELETE SET NULL
    ) STRICT;
    CREATE INDEX idx_pomodoro_started ON pomodoro_sessions(started_at);

    CREATE TABLE window_layouts (
        app_id    TEXT PRIMARY KEY,
        x         REAL NOT NULL,
        y         REAL NOT NULL,
        w         REAL NOT NULL,
        h         REAL NOT NULL,
        maximized INTEGER NOT NULL DEFAULT 0
    ) STRICT;

    CREATE TABLE quick_links (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        label      TEXT NOT NULL,
        url        TEXT NOT NULL,
        icon       TEXT,
        sort_order INTEGER NOT NULL
    ) STRICT;
    ",
    // v2 — apps externos (navegadores, editores) lançáveis pelo shell
    "
    CREATE TABLE external_apps (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        label      TEXT NOT NULL,
        command    TEXT NOT NULL,
        args       TEXT NOT NULL DEFAULT '',
        icon       TEXT NOT NULL DEFAULT 'app',
        sort_order INTEGER NOT NULL
    ) STRICT;
    ",
];

pub fn run(conn: &Connection) -> Result<()> {
    let current: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
    for (i, sql) in MIGRATIONS.iter().enumerate() {
        let version = (i + 1) as i64;
        if version > current {
            conn.execute_batch(&format!(
                "BEGIN;\n{sql}\nPRAGMA user_version = {version};\nCOMMIT;"
            ))?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrations_rodam_e_sao_idempotentes() {
        let conn = Connection::open_in_memory().unwrap();
        run(&conn).unwrap();
        run(&conn).unwrap(); // segunda vez: no-op

        let version: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0)).unwrap();
        assert_eq!(version, MIGRATIONS.len() as i64);

        let tables: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
            .unwrap()
            .query_map([], |r| r.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();
        for expected in [
            "settings",
            "todos",
            "pomodoro_sessions",
            "window_layouts",
            "quick_links",
            "external_apps",
        ] {
            assert!(tables.iter().any(|t| t == expected), "faltou tabela {expected}");
        }
    }
}
