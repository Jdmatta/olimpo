//! Camada de repositório: TODO SQL do app vive aqui, sempre com params![].

use rusqlite::{Connection, OptionalExtension, params};
use serde::Serialize;

use crate::error::{Error, Result};

// ---------- settings ----------

pub fn settings_get(conn: &Connection, key: &str) -> Result<Option<String>> {
    conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        params![key],
        |r| r.get(0),
    )
    .optional()
    .map_err(Error::Db)
}

pub fn settings_set(conn: &Connection, key: &str, value: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )?;
    Ok(())
}

// ---------- todos ----------

#[derive(Debug, Serialize, PartialEq)]
pub struct Todo {
    pub id: i64,
    pub title: String,
    pub done: bool,
    pub day: String,
    pub sort_order: i64,
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

pub fn todo_list(conn: &Connection, day: &str) -> Result<Vec<Todo>> {
    let mut stmt = conn.prepare(
        "SELECT id, title, done, day, sort_order FROM todos
         WHERE day = ?1 ORDER BY sort_order, id",
    )?;
    let rows = stmt
        .query_map(params![day], |r| {
            Ok(Todo {
                id: r.get(0)?,
                title: r.get(1)?,
                done: r.get::<_, i64>(2)? != 0,
                day: r.get(3)?,
                sort_order: r.get(4)?,
            })
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    Ok(rows)
}

pub fn todo_add(conn: &Connection, title: &str, day: &str) -> Result<Todo> {
    let title = title.trim();
    if title.is_empty() || title.len() > 500 {
        return Err(Error::InvalidInput("título vazio ou longo demais".into()));
    }
    let next_order: i64 = conn.query_row(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM todos WHERE day = ?1",
        params![day],
        |r| r.get(0),
    )?;
    conn.execute(
        "INSERT INTO todos (title, done, day, sort_order, created_at)
         VALUES (?1, 0, ?2, ?3, ?4)",
        params![title, day, next_order, now_ms()],
    )?;
    let id = conn.last_insert_rowid();
    Ok(Todo {
        id,
        title: title.to_string(),
        done: false,
        day: day.to_string(),
        sort_order: next_order,
    })
}

pub fn todo_toggle(conn: &Connection, id: i64) -> Result<bool> {
    let done: Option<i64> = conn
        .query_row("SELECT done FROM todos WHERE id = ?1", params![id], |r| {
            r.get(0)
        })
        .optional()?;
    let done = done.ok_or(Error::NotFound)? != 0;
    let new_done = !done;
    conn.execute(
        "UPDATE todos SET done = ?2, completed_at = ?3 WHERE id = ?1",
        params![id, new_done as i64, if new_done { Some(now_ms()) } else { None }],
    )?;
    Ok(new_done)
}

pub fn todo_delete(conn: &Connection, id: i64) -> Result<()> {
    let changed = conn.execute("DELETE FROM todos WHERE id = ?1", params![id])?;
    if changed == 0 {
        return Err(Error::NotFound);
    }
    Ok(())
}

/// Reordena os todos de um dia conforme a lista de ids recebida.
pub fn todo_reorder(conn: &Connection, day: &str, ids: &[i64]) -> Result<()> {
    let tx_guard = conn.unchecked_transaction()?;
    for (order, id) in ids.iter().enumerate() {
        conn.execute(
            "UPDATE todos SET sort_order = ?1 WHERE id = ?2 AND day = ?3",
            params![order as i64, id, day],
        )?;
    }
    tx_guard.commit()?;
    Ok(())
}

/// Copia os não-feitos de `from_day` para `to_day` (carry-over do dia).
pub fn todo_carry_over(conn: &Connection, from_day: &str, to_day: &str) -> Result<u32> {
    let moved = conn.execute(
        "UPDATE todos SET day = ?2,
            sort_order = sort_order + (SELECT COALESCE(MAX(sort_order), -1) + 1
                                       FROM todos WHERE day = ?2)
         WHERE day = ?1 AND done = 0",
        params![from_day, to_day],
    )?;
    Ok(moved as u32)
}

// ---------- pomodoro ----------

#[derive(Debug, Serialize)]
pub struct PomodoroSession {
    pub id: i64,
    pub kind: String,
    pub planned_min: i64,
    pub started_at: i64,
    pub ended_at: Option<i64>,
    pub completed: bool,
    pub todo_id: Option<i64>,
}

pub fn pomodoro_start(
    conn: &Connection,
    kind: &str,
    planned_min: i64,
    todo_id: Option<i64>,
) -> Result<i64> {
    if !matches!(kind, "focus" | "break") {
        return Err(Error::InvalidInput("kind deve ser focus|break".into()));
    }
    if !(1..=180).contains(&planned_min) {
        return Err(Error::InvalidInput("duração fora de 1..180 min".into()));
    }
    conn.execute(
        "INSERT INTO pomodoro_sessions (kind, planned_min, started_at, todo_id)
         VALUES (?1, ?2, ?3, ?4)",
        params![kind, planned_min, now_ms(), todo_id],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn pomodoro_finish(conn: &Connection, id: i64, completed: bool) -> Result<()> {
    let changed = conn.execute(
        "UPDATE pomodoro_sessions SET ended_at = ?2, completed = ?3 WHERE id = ?1",
        params![id, now_ms(), completed as i64],
    )?;
    if changed == 0 {
        return Err(Error::NotFound);
    }
    Ok(())
}

/// Sessão de foco aberta (sem ended_at) — para restaurar após restart.
pub fn pomodoro_open_session(conn: &Connection) -> Result<Option<PomodoroSession>> {
    conn.query_row(
        "SELECT id, kind, planned_min, started_at, ended_at, completed, todo_id
         FROM pomodoro_sessions WHERE ended_at IS NULL
         ORDER BY started_at DESC LIMIT 1",
        [],
        |r| {
            Ok(PomodoroSession {
                id: r.get(0)?,
                kind: r.get(1)?,
                planned_min: r.get(2)?,
                started_at: r.get(3)?,
                ended_at: r.get(4)?,
                completed: r.get::<_, i64>(5)? != 0,
                todo_id: r.get(6)?,
            })
        },
    )
    .optional()
    .map_err(Error::Db)
}

#[derive(Debug, Serialize)]
pub struct DayStat {
    pub day: String,
    pub focus_completed: i64,
    pub focus_minutes: i64,
}

/// Histórico agregado por dia (sessões de foco completas), últimos `days` dias.
pub fn pomodoro_history(conn: &Connection, days: u32) -> Result<Vec<DayStat>> {
    let days = days.min(90) as i64;
    let since = now_ms() - days * 24 * 60 * 60 * 1000;
    let mut stmt = conn.prepare(
        "SELECT date(started_at / 1000, 'unixepoch', 'localtime') AS day,
                COUNT(*) AS sessions,
                SUM(planned_min) AS minutes
         FROM pomodoro_sessions
         WHERE kind = 'focus' AND completed = 1 AND started_at >= ?1
         GROUP BY day ORDER BY day",
    )?;
    let rows = stmt
        .query_map(params![since], |r| {
            Ok(DayStat {
                day: r.get(0)?,
                focus_completed: r.get(1)?,
                focus_minutes: r.get::<_, Option<i64>>(2)?.unwrap_or(0),
            })
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    Ok(rows)
}

// ---------- window layouts ----------

#[derive(Debug, Serialize, PartialEq)]
pub struct WindowLayout {
    pub app_id: String,
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    pub maximized: bool,
}

pub fn layout_save(conn: &Connection, layout: &WindowLayout) -> Result<()> {
    conn.execute(
        "INSERT INTO window_layouts (app_id, x, y, w, h, maximized)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(app_id) DO UPDATE SET
            x = excluded.x, y = excluded.y, w = excluded.w, h = excluded.h,
            maximized = excluded.maximized",
        params![
            layout.app_id,
            layout.x,
            layout.y,
            layout.w,
            layout.h,
            layout.maximized as i64
        ],
    )?;
    Ok(())
}

pub fn layout_all(conn: &Connection) -> Result<Vec<WindowLayout>> {
    let mut stmt =
        conn.prepare("SELECT app_id, x, y, w, h, maximized FROM window_layouts")?;
    let rows = stmt
        .query_map([], |r| {
            Ok(WindowLayout {
                app_id: r.get(0)?,
                x: r.get(1)?,
                y: r.get(2)?,
                w: r.get(3)?,
                h: r.get(4)?,
                maximized: r.get::<_, i64>(5)? != 0,
            })
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    Ok(rows)
}

// ---------- quick links ----------

#[derive(Debug, Serialize)]
pub struct QuickLink {
    pub id: i64,
    pub label: String,
    pub url: String,
    pub icon: Option<String>,
    pub sort_order: i64,
}

/// Só http/https — o opener nunca recebe outra coisa.
fn validate_link_url(url: &str) -> Result<()> {
    let lower = url.to_ascii_lowercase();
    if !(lower.starts_with("https://") || lower.starts_with("http://")) {
        return Err(Error::InvalidInput("URL precisa ser http(s)".into()));
    }
    if url.len() > 2000 {
        return Err(Error::InvalidInput("URL longa demais".into()));
    }
    Ok(())
}

pub fn quicklink_add(
    conn: &Connection,
    label: &str,
    url: &str,
    icon: Option<&str>,
) -> Result<QuickLink> {
    let label = label.trim();
    if label.is_empty() || label.len() > 100 {
        return Err(Error::InvalidInput("label vazio ou longo demais".into()));
    }
    validate_link_url(url)?;
    let next_order: i64 = conn.query_row(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM quick_links",
        [],
        |r| r.get(0),
    )?;
    conn.execute(
        "INSERT INTO quick_links (label, url, icon, sort_order) VALUES (?1, ?2, ?3, ?4)",
        params![label, url, icon, next_order],
    )?;
    Ok(QuickLink {
        id: conn.last_insert_rowid(),
        label: label.to_string(),
        url: url.to_string(),
        icon: icon.map(String::from),
        sort_order: next_order,
    })
}

pub fn quicklink_list(conn: &Connection) -> Result<Vec<QuickLink>> {
    let mut stmt = conn
        .prepare("SELECT id, label, url, icon, sort_order FROM quick_links ORDER BY sort_order, id")?;
    let rows = stmt
        .query_map([], |r| {
            Ok(QuickLink {
                id: r.get(0)?,
                label: r.get(1)?,
                url: r.get(2)?,
                icon: r.get(3)?,
                sort_order: r.get(4)?,
            })
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    Ok(rows)
}

pub fn quicklink_delete(conn: &Connection, id: i64) -> Result<()> {
    let changed = conn.execute("DELETE FROM quick_links WHERE id = ?1", params![id])?;
    if changed == 0 {
        return Err(Error::NotFound);
    }
    Ok(())
}

// ---------- external apps ----------

#[derive(Debug, Serialize)]
pub struct ExternalApp {
    pub id: i64,
    pub label: String,
    pub command: String,
    pub args: String,
    pub icon: String,
    pub sort_order: i64,
}

/// Comando precisa ser um executável absoluto EXISTENTE — nunca string de shell.
fn validate_app_command(command: &str) -> Result<()> {
    let path = std::path::Path::new(command);
    if !path.is_absolute() {
        return Err(Error::InvalidInput("caminho do executável precisa ser absoluto".into()));
    }
    let ext = path
        .extension()
        .map(|e| e.to_string_lossy().to_ascii_lowercase())
        .unwrap_or_default();
    if !matches!(ext.as_str(), "exe" | "cmd" | "bat") {
        return Err(Error::InvalidInput("só executáveis .exe/.cmd/.bat".into()));
    }
    if !path.is_file() {
        return Err(Error::PathNotFound(command.to_string()));
    }
    Ok(())
}

pub fn extapp_add(
    conn: &Connection,
    label: &str,
    command: &str,
    args: &str,
    icon: &str,
) -> Result<ExternalApp> {
    let label = label.trim();
    if label.is_empty() || label.len() > 60 {
        return Err(Error::InvalidInput("nome vazio ou longo demais".into()));
    }
    validate_app_command(command)?;
    if args.len() > 500 {
        return Err(Error::InvalidInput("args longos demais".into()));
    }
    let icon = if matches!(icon, "globe" | "code" | "app") { icon } else { "app" };
    let next_order: i64 = conn.query_row(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM external_apps",
        [],
        |r| r.get(0),
    )?;
    conn.execute(
        "INSERT INTO external_apps (label, command, args, icon, sort_order)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![label, command, args, icon, next_order],
    )?;
    Ok(ExternalApp {
        id: conn.last_insert_rowid(),
        label: label.to_string(),
        command: command.to_string(),
        args: args.to_string(),
        icon: icon.to_string(),
        sort_order: next_order,
    })
}

pub fn extapp_list(conn: &Connection) -> Result<Vec<ExternalApp>> {
    let mut stmt = conn.prepare(
        "SELECT id, label, command, args, icon, sort_order
         FROM external_apps ORDER BY sort_order, id",
    )?;
    let rows = stmt
        .query_map([], |r| {
            Ok(ExternalApp {
                id: r.get(0)?,
                label: r.get(1)?,
                command: r.get(2)?,
                args: r.get(3)?,
                icon: r.get(4)?,
                sort_order: r.get(5)?,
            })
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    Ok(rows)
}

pub fn extapp_get(conn: &Connection, id: i64) -> Result<ExternalApp> {
    conn.query_row(
        "SELECT id, label, command, args, icon, sort_order FROM external_apps WHERE id = ?1",
        params![id],
        |r| {
            Ok(ExternalApp {
                id: r.get(0)?,
                label: r.get(1)?,
                command: r.get(2)?,
                args: r.get(3)?,
                icon: r.get(4)?,
                sort_order: r.get(5)?,
            })
        },
    )
    .optional()?
    .ok_or(Error::NotFound)
}

pub fn extapp_delete(conn: &Connection, id: i64) -> Result<()> {
    let changed = conn.execute("DELETE FROM external_apps WHERE id = ?1", params![id])?;
    if changed == 0 {
        return Err(Error::NotFound);
    }
    Ok(())
}

pub fn extapp_count(conn: &Connection) -> Result<i64> {
    conn.query_row("SELECT COUNT(*) FROM external_apps", [], |r| r.get(0))
        .map_err(Error::Db)
}

// ---------- notas / post-its ----------

#[derive(Debug, Serialize)]
pub struct Note {
    pub id: i64,
    pub content: String,
    pub color: String,
    pub topic: String,
    pub kind: String,
    pub front: String,
    pub back: String,
    pub on_desktop: bool,
    pub x: f64,
    pub y: f64,
    pub reviewed_ok: i64,
    pub reviewed_fail: i64,
}

const NOTE_COLORS: &[&str] = &["louro", "rosa", "menta", "ceu", "lavanda"];
const MAX_NOTE_LEN: usize = 4000;

fn validate_note_texts(content: &str, front: &str, back: &str, topic: &str) -> Result<()> {
    if content.len() > MAX_NOTE_LEN || front.len() > MAX_NOTE_LEN || back.len() > MAX_NOTE_LEN {
        return Err(Error::InvalidInput("nota longa demais (4000)".into()));
    }
    if topic.trim().is_empty() || topic.len() > 60 {
        return Err(Error::InvalidInput("tópico vazio ou longo demais".into()));
    }
    Ok(())
}

fn note_color(color: &str) -> &str {
    if NOTE_COLORS.contains(&color) { color } else { "louro" }
}

fn row_to_note(r: &rusqlite::Row) -> rusqlite::Result<Note> {
    Ok(Note {
        id: r.get(0)?,
        content: r.get(1)?,
        color: r.get(2)?,
        topic: r.get(3)?,
        kind: r.get(4)?,
        front: r.get(5)?,
        back: r.get(6)?,
        on_desktop: r.get::<_, i64>(7)? != 0,
        x: r.get(8)?,
        y: r.get(9)?,
        reviewed_ok: r.get(10)?,
        reviewed_fail: r.get(11)?,
    })
}

const NOTE_COLS: &str =
    "id, content, color, topic, kind, front, back, on_desktop, x, y, reviewed_ok, reviewed_fail";

pub fn note_add(conn: &Connection, topic: &str, color: &str, x: f64, y: f64) -> Result<Note> {
    let topic = topic.trim();
    validate_note_texts("", "", "", topic)?;
    conn.execute(
        "INSERT INTO notes (content, color, topic, on_desktop, x, y, created_at)
         VALUES ('', ?1, ?2, 1, ?3, ?4, ?5)",
        params![note_color(color), topic, x, y, now_ms()],
    )?;
    let id = conn.last_insert_rowid();
    conn.query_row(
        &format!("SELECT {NOTE_COLS} FROM notes WHERE id = ?1"),
        params![id],
        row_to_note,
    )
    .map_err(Error::Db)
}

pub fn note_list(conn: &Connection, topic: Option<&str>, desktop_only: bool) -> Result<Vec<Note>> {
    let mut sql = format!("SELECT {NOTE_COLS} FROM notes WHERE 1=1");
    if topic.is_some() {
        sql.push_str(" AND topic = ?1");
    }
    if desktop_only {
        sql.push_str(" AND on_desktop = 1");
    }
    sql.push_str(" ORDER BY sort_order, id");
    let mut stmt = conn.prepare(&sql)?;
    let rows = match topic {
        Some(t) => stmt.query_map(params![t], row_to_note)?,
        None => stmt.query_map([], row_to_note)?,
    }
    .collect::<std::result::Result<Vec<_>, _>>()?;
    Ok(rows)
}

#[allow(clippy::too_many_arguments)]
pub fn note_update(
    conn: &Connection,
    id: i64,
    content: &str,
    color: &str,
    topic: &str,
    kind: &str,
    front: &str,
    back: &str,
    on_desktop: bool,
    x: f64,
    y: f64,
) -> Result<()> {
    let topic = topic.trim();
    validate_note_texts(content, front, back, topic)?;
    if !matches!(kind, "note" | "flash") {
        return Err(Error::InvalidInput("kind deve ser note|flash".into()));
    }
    let changed = conn.execute(
        "UPDATE notes SET content = ?2, color = ?3, topic = ?4, kind = ?5,
                front = ?6, back = ?7, on_desktop = ?8, x = ?9, y = ?10
         WHERE id = ?1",
        params![
            id,
            content,
            note_color(color),
            topic,
            kind,
            front,
            back,
            on_desktop as i64,
            x,
            y
        ],
    )?;
    if changed == 0 {
        return Err(Error::NotFound);
    }
    Ok(())
}

pub fn note_delete(conn: &Connection, id: i64) -> Result<()> {
    let changed = conn.execute("DELETE FROM notes WHERE id = ?1", params![id])?;
    if changed == 0 {
        return Err(Error::NotFound);
    }
    Ok(())
}

pub fn note_topics(conn: &Connection) -> Result<Vec<String>> {
    let mut stmt =
        conn.prepare("SELECT topic, COUNT(*) FROM notes GROUP BY topic ORDER BY MAX(created_at) DESC")?;
    let rows = stmt
        .query_map([], |r| r.get::<_, String>(0))?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    Ok(rows)
}

pub fn note_review_mark(conn: &Connection, id: i64, ok: bool) -> Result<()> {
    let col = if ok { "reviewed_ok" } else { "reviewed_fail" };
    let changed = conn.execute(
        &format!("UPDATE notes SET {col} = {col} + 1 WHERE id = ?1"),
        params![id],
    )?;
    if changed == 0 {
        return Err(Error::NotFound);
    }
    Ok(())
}

/// Resumo markdown do tópico: notas como bullets, flashcards como Q/A.
pub fn notes_to_markdown(topic: &str, notes: &[Note]) -> String {
    let mut md = format!("# Resumo — {topic}\n\n");
    let plain: Vec<_> = notes.iter().filter(|n| n.kind == "note").collect();
    let flash: Vec<_> = notes.iter().filter(|n| n.kind == "flash").collect();
    if !plain.is_empty() {
        md.push_str("## Anotações\n\n");
        for n in &plain {
            let trimmed = n.content.trim();
            if !trimmed.is_empty() {
                for (i, line) in trimmed.lines().enumerate() {
                    if i == 0 {
                        md.push_str(&format!("- {line}\n"));
                    } else {
                        md.push_str(&format!("  {line}\n"));
                    }
                }
            }
        }
        md.push('\n');
    }
    if !flash.is_empty() {
        md.push_str("## Flashcards\n\n");
        for n in &flash {
            md.push_str(&format!("**P:** {}\n\n**R:** {}\n\n---\n\n", n.front.trim(), n.back.trim()));
        }
    }
    md
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Db;

    fn db() -> Db {
        Db::open_in_memory().unwrap()
    }

    #[test]
    fn settings_roundtrip_e_upsert() {
        let db = db();
        db.with(|c| {
            assert_eq!(settings_get(c, "tema")?, None);
            settings_set(c, "tema", "noite")?;
            settings_set(c, "tema", "amanhecer")?;
            assert_eq!(settings_get(c, "tema")?, Some("amanhecer".into()));
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn todos_crud_ordenacao_e_carry_over() {
        let db = db();
        db.with(|c| {
            let a = todo_add(c, "estudar Rust", "2026-07-17")?;
            let b = todo_add(c, "  revisar PR  ", "2026-07-17")?;
            assert_eq!(b.title, "revisar PR");
            assert_eq!(b.sort_order, 1);

            assert!(todo_toggle(c, a.id)?);
            let list = todo_list(c, "2026-07-17")?;
            assert_eq!(list.len(), 2);
            assert!(list[0].done);

            todo_reorder(c, "2026-07-17", &[b.id, a.id])?;
            let list = todo_list(c, "2026-07-17")?;
            assert_eq!(list[0].id, b.id);

            // Carry-over leva só o não-feito (b).
            let moved = todo_carry_over(c, "2026-07-17", "2026-07-18")?;
            assert_eq!(moved, 1);
            assert_eq!(todo_list(c, "2026-07-18")?[0].id, b.id);
            assert_eq!(todo_list(c, "2026-07-17")?.len(), 1);

            todo_delete(c, a.id)?;
            assert!(matches!(todo_delete(c, a.id), Err(Error::NotFound)));
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn todo_add_valida_input() {
        let db = db();
        db.with(|c| {
            assert!(todo_add(c, "   ", "2026-07-17").is_err());
            assert!(todo_add(c, &"x".repeat(501), "2026-07-17").is_err());
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn pomodoro_fluxo_e_historico() {
        let db = db();
        db.with(|c| {
            assert!(pomodoro_start(c, "hack", 25, None).is_err());
            assert!(pomodoro_start(c, "focus", 0, None).is_err());

            let id = pomodoro_start(c, "focus", 25, None)?;
            assert_eq!(pomodoro_open_session(c)?.map(|s| s.id), Some(id));

            pomodoro_finish(c, id, true)?;
            assert!(pomodoro_open_session(c)?.is_none());

            let hist = pomodoro_history(c, 14)?;
            assert_eq!(hist.len(), 1);
            assert_eq!(hist[0].focus_completed, 1);
            assert_eq!(hist[0].focus_minutes, 25);
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn layout_upsert_e_leitura() {
        let db = db();
        db.with(|c| {
            let l1 = WindowLayout {
                app_id: "files".into(),
                x: 10.0,
                y: 40.0,
                w: 900.0,
                h: 560.0,
                maximized: false,
            };
            layout_save(c, &l1)?;
            layout_save(
                c,
                &WindowLayout {
                    x: 22.0,
                    ..WindowLayout { app_id: "files".into(), x: 0.0, y: 40.0, w: 900.0, h: 560.0, maximized: true }
                },
            )?;
            let all = layout_all(c)?;
            assert_eq!(all.len(), 1);
            assert_eq!(all[0].x, 22.0);
            assert!(all[0].maximized);
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn extapps_validam_comando() {
        let db = db();
        db.with(|c| {
            // cmd.exe existe em qualquer Windows — comando válido de teste.
            let cmd = "C:\\Windows\\System32\\cmd.exe";
            let app = extapp_add(c, "CMD", cmd, "", "app")?;
            assert_eq!(app.icon, "app");
            assert_eq!(extapp_count(c)?, 1);
            assert_eq!(extapp_get(c, app.id)?.command, cmd);

            // relativos, extensão errada, inexistente, ícone inválido vira 'app'
            assert!(extapp_add(c, "x", "cmd.exe", "", "app").is_err());
            assert!(extapp_add(c, "x", "C:\\Windows\\System32\\kernel32.dll", "", "app").is_err());
            assert!(extapp_add(c, "x", "C:\\nao-existe\\app.exe", "", "app").is_err());
            assert!(extapp_add(c, "", cmd, "", "app").is_err());
            let weird = extapp_add(c, "Weird", cmd, "", "banana")?;
            assert_eq!(weird.icon, "app");

            extapp_delete(c, app.id)?;
            assert!(matches!(extapp_get(c, app.id), Err(Error::NotFound)));
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn notas_crud_review_e_markdown() {
        let db = db();
        db.with(|c| {
            let a = note_add(c, "Rust", "menta", 100.0, 200.0)?;
            assert_eq!(a.color, "menta");
            assert!(a.on_desktop);
            // cor fora da whitelist cai no default
            let b = note_add(c, "Rust", "neon-hacker", 0.0, 0.0)?;
            assert_eq!(b.color, "louro");

            note_update(c, a.id, "ownership move semantics", "menta", "Rust", "note", "", "", true, 111.0, 222.0)?;
            note_update(c, b.id, "", "rosa", "Rust", "flash", "O que é borrow?", "Empréstimo sem posse", false, 0.0, 0.0)?;

            assert!(note_update(c, a.id, "x", "menta", "Rust", "hack", "", "", true, 0.0, 0.0).is_err());
            assert!(note_add(c, "  ", "menta", 0.0, 0.0).is_err());
            assert!(note_update(c, a.id, &"x".repeat(4001), "menta", "Rust", "note", "", "", true, 0.0, 0.0).is_err());

            let desktop = note_list(c, None, true)?;
            assert_eq!(desktop.len(), 1);
            assert_eq!(desktop[0].x, 111.0);

            note_review_mark(c, b.id, true)?;
            note_review_mark(c, b.id, false)?;
            let all = note_list(c, Some("Rust"), false)?;
            let flash = all.iter().find(|n| n.kind == "flash").unwrap();
            assert_eq!((flash.reviewed_ok, flash.reviewed_fail), (1, 1));

            let md = notes_to_markdown("Rust", &all);
            assert!(md.contains("# Resumo — Rust"));
            assert!(md.contains("- ownership move semantics"));
            assert!(md.contains("**P:** O que é borrow?"));

            assert_eq!(note_topics(c)?, vec!["Rust".to_string()]);
            note_delete(c, a.id)?;
            assert!(matches!(note_delete(c, a.id), Err(Error::NotFound)));
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn quicklinks_validam_url() {
        let db = db();
        db.with(|c| {
            assert!(quicklink_add(c, "LinkedIn", "https://linkedin.com/in/jdmatta", None).is_ok());
            assert!(quicklink_add(c, "mal", "javascript:alert(1)", None).is_err());
            assert!(quicklink_add(c, "mal", "file:///C:/Windows", None).is_err());
            assert!(quicklink_add(c, "", "https://ok.com", None).is_err());
            let list = quicklink_list(c)?;
            assert_eq!(list.len(), 1);
            quicklink_delete(c, list[0].id)?;
            assert!(matches!(quicklink_delete(c, list[0].id), Err(Error::NotFound)));
            Ok(())
        })
        .unwrap();
    }
}
