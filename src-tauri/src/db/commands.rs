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
