use tauri::State;

use crate::db::repos;
use crate::db::{DayStat, PomodoroSession, QuickLink, Todo, WindowLayout};
use crate::error::Result;
use crate::state::AppState;

// ---------- settings ----------

#[tauri::command]
pub fn settings_get(state: State<'_, AppState>, key: String) -> Result<Option<String>> {
    state.db.with(|c| repos::settings_get(c, &key))
}

#[tauri::command]
pub fn settings_set(state: State<'_, AppState>, key: String, value: String) -> Result<()> {
    state.db.with(|c| repos::settings_set(c, &key, &value))
}

// ---------- todos ----------

#[tauri::command]
pub fn todo_list(state: State<'_, AppState>, day: String) -> Result<Vec<Todo>> {
    state.db.with(|c| repos::todo_list(c, &day))
}

#[tauri::command]
pub fn todo_add(state: State<'_, AppState>, title: String, day: String) -> Result<Todo> {
    state.db.with(|c| repos::todo_add(c, &title, &day))
}

#[tauri::command]
pub fn todo_toggle(state: State<'_, AppState>, id: i64) -> Result<bool> {
    state.db.with(|c| repos::todo_toggle(c, id))
}

#[tauri::command]
pub fn todo_delete(state: State<'_, AppState>, id: i64) -> Result<()> {
    state.db.with(|c| repos::todo_delete(c, id))
}

#[tauri::command]
pub fn todo_reorder(state: State<'_, AppState>, day: String, ids: Vec<i64>) -> Result<()> {
    state.db.with(|c| repos::todo_reorder(c, &day, &ids))
}

#[tauri::command]
pub fn todo_carry_over(
    state: State<'_, AppState>,
    from_day: String,
    to_day: String,
) -> Result<u32> {
    state.db.with(|c| repos::todo_carry_over(c, &from_day, &to_day))
}

// ---------- pomodoro ----------

#[tauri::command]
pub fn pomodoro_start(
    state: State<'_, AppState>,
    kind: String,
    planned_min: i64,
    todo_id: Option<i64>,
) -> Result<i64> {
    state
        .db
        .with(|c| repos::pomodoro_start(c, &kind, planned_min, todo_id))
}

#[tauri::command]
pub fn pomodoro_finish(state: State<'_, AppState>, id: i64, completed: bool) -> Result<()> {
    state.db.with(|c| repos::pomodoro_finish(c, id, completed))
}

#[tauri::command]
pub fn pomodoro_open_session(state: State<'_, AppState>) -> Result<Option<PomodoroSession>> {
    state.db.with(repos::pomodoro_open_session)
}

#[tauri::command]
pub fn pomodoro_history(state: State<'_, AppState>, days: u32) -> Result<Vec<DayStat>> {
    state.db.with(|c| repos::pomodoro_history(c, days))
}

// ---------- layouts ----------

#[tauri::command]
pub fn layout_save(
    state: State<'_, AppState>,
    app_id: String,
    x: f64,
    y: f64,
    w: f64,
    h: f64,
    maximized: bool,
) -> Result<()> {
    state.db.with(|c| {
        repos::layout_save(
            c,
            &WindowLayout {
                app_id,
                x,
                y,
                w,
                h,
                maximized,
            },
        )
    })
}

#[tauri::command]
pub fn layout_all(state: State<'_, AppState>) -> Result<Vec<WindowLayout>> {
    state.db.with(repos::layout_all)
}

// ---------- notas / post-its ----------

use crate::db::repos::Note;

#[tauri::command]
pub fn note_add(
    state: State<'_, AppState>,
    topic: String,
    color: String,
    x: f64,
    y: f64,
) -> Result<Note> {
    state.db.with(|c| repos::note_add(c, &topic, &color, x, y))
}

#[tauri::command]
pub fn note_list(
    state: State<'_, AppState>,
    topic: Option<String>,
    desktop_only: bool,
) -> Result<Vec<Note>> {
    state
        .db
        .with(|c| repos::note_list(c, topic.as_deref(), desktop_only))
}

#[derive(serde::Deserialize)]
pub struct NotePatch {
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
}

#[tauri::command]
pub fn note_update(state: State<'_, AppState>, note: NotePatch) -> Result<()> {
    state.db.with(|c| {
        repos::note_update(
            c,
            note.id,
            &note.content,
            &note.color,
            &note.topic,
            &note.kind,
            &note.front,
            &note.back,
            note.on_desktop,
            note.x,
            note.y,
        )
    })
}

#[tauri::command]
pub fn note_delete(state: State<'_, AppState>, id: i64) -> Result<()> {
    state.db.with(|c| repos::note_delete(c, id))
}

#[tauri::command]
pub fn note_topics(state: State<'_, AppState>) -> Result<Vec<String>> {
    state.db.with(repos::note_topics)
}

#[tauri::command]
pub fn note_review_mark(state: State<'_, AppState>, id: i64, ok: bool) -> Result<()> {
    state.db.with(|c| repos::note_review_mark(c, id, ok))
}

/// Exporta o resumo do tópico como .md em {workspace}\docs-estudo\ (via guard).
#[tauri::command]
pub fn notes_export(state: State<'_, AppState>, topic: String) -> Result<String> {
    let notes = state
        .db
        .with(|c| repos::note_list(c, Some(topic.trim()), false))?;
    if notes.is_empty() {
        return Err(crate::error::Error::InvalidInput("tópico sem notas".into()));
    }
    let md = repos::notes_to_markdown(topic.trim(), &notes);

    let root = state.guard.root().to_string_lossy().into_owned();
    let dir = state.guard.resolve_new(&root, "docs-estudo")?;
    if !dir.exists() {
        std::fs::create_dir(&dir)?;
    }
    // Nome de arquivo seguro a partir do tópico.
    let safe: String = topic
        .trim()
        .chars()
        .map(|ch| if ch.is_alphanumeric() { ch.to_ascii_lowercase() } else { '-' })
        .take(40)
        .collect();
    let day = chrono_free_today();
    let filename = format!("resumo-{safe}-{day}.md");
    let target = state
        .guard
        .resolve_new(&dir.to_string_lossy(), &filename)?;
    std::fs::write(&target, md)?;
    Ok(target.to_string_lossy().into_owned())
}

/// AAAA-MM-DD local sem depender do crate chrono.
fn chrono_free_today() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    // Aproximação civil (UTC): suficiente para nome de arquivo.
    let days = now / 86_400;
    let (mut y, mut rem) = (1970i64, days as i64);
    loop {
        let leap = (y % 4 == 0 && y % 100 != 0) || y % 400 == 0;
        let len = if leap { 366 } else { 365 };
        if rem < len {
            break;
        }
        rem -= len;
        y += 1;
    }
    let leap = (y % 4 == 0 && y % 100 != 0) || y % 400 == 0;
    let months = [
        31,
        if leap { 29 } else { 28 },
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ];
    let mut m = 0usize;
    while rem >= months[m] {
        rem -= months[m];
        m += 1;
    }
    format!("{y}-{:02}-{:02}", m + 1, rem + 1)
}

// ---------- quick links ----------

#[tauri::command]
pub fn quicklink_add(
    state: State<'_, AppState>,
    label: String,
    url: String,
    icon: Option<String>,
) -> Result<QuickLink> {
    state
        .db
        .with(|c| repos::quicklink_add(c, &label, &url, icon.as_deref()))
}

#[tauri::command]
pub fn quicklink_list(state: State<'_, AppState>) -> Result<Vec<QuickLink>> {
    state.db.with(repos::quicklink_list)
}

#[tauri::command]
pub fn quicklink_delete(state: State<'_, AppState>, id: i64) -> Result<()> {
    state.db.with(|c| repos::quicklink_delete(c, id))
}
