/**
 * ÚNICA superfície de IPC do frontend — todo `invoke` tipado vive aqui.
 * Componentes nunca chamam invoke direto (regra do CLAUDE.md do projeto).
 */
import { Channel, invoke } from "@tauri-apps/api/core";

export type ShellProfile = "pwsh" | "powershell" | "cmd";

interface PtyExitMessage {
  type: "exit";
}

export interface PtySpawnOptions {
  profile: ShellProfile;
  cols: number;
  rows: number;
  cwd?: string;
}

export async function ptySpawn(
  opts: PtySpawnOptions,
  onData: (data: Uint8Array) => void,
  onExit: () => void,
): Promise<number> {
  const channel = new Channel<ArrayBuffer | Uint8Array | PtyExitMessage>();
  channel.onmessage = (message) => {
    if (message instanceof ArrayBuffer) {
      onData(new Uint8Array(message));
    } else if (message instanceof Uint8Array) {
      onData(message);
    } else if (message.type === "exit") {
      onExit();
    }
  };
  return invoke<number>("pty_spawn", { ...opts, onData: channel });
}

export function ptyWrite(id: number, data: string): Promise<void> {
  return invoke("pty_write", { id, data });
}

export function ptyResize(id: number, cols: number, rows: number): Promise<void> {
  return invoke("pty_resize", { id, cols, rows });
}

export function ptyKill(id: number): Promise<void> {
  return invoke("pty_kill", { id });
}

// ---------- Arquivos ----------

export interface FsEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified_ms: number;
}

export interface FsListing {
  path: string;
  entries: FsEntry[];
}

export interface FsRoot {
  label: string;
  path: string;
}

/** Raízes navegáveis (Workspace, Documents, Downloads, .claude). */
export function fsRoots(): Promise<FsRoot[]> {
  return invoke("fs_roots");
}

export function fsList(path?: string): Promise<FsListing> {
  return invoke("fs_list", { path: path ?? null });
}

export function fsCreateDir(parent: string, name: string): Promise<FsEntry> {
  return invoke("fs_create_dir", { parent, name });
}

export function fsCreateFile(parent: string, name: string): Promise<FsEntry> {
  return invoke("fs_create_file", { parent, name });
}

export function fsRename(path: string, newName: string): Promise<FsEntry> {
  return invoke("fs_rename", { path, newName });
}

export function fsMove(path: string, targetDir: string): Promise<FsEntry> {
  return invoke("fs_move", { path, targetDir });
}

/** Vai para a Lixeira — nunca deleta permanente (regra do projeto). */
export function fsDelete(path: string): Promise<void> {
  return invoke("fs_delete", { path });
}

export function fsOpenInVsCode(path: string): Promise<void> {
  return invoke("fs_open_in_vscode", { path });
}

export function fsRevealInExplorer(path: string): Promise<void> {
  return invoke("fs_reveal_in_explorer", { path });
}

// ---------- Layouts de janela ----------

export interface WindowLayoutDto {
  app_id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  maximized: boolean;
}

export function layoutSave(layout: WindowLayoutDto): Promise<void> {
  const { app_id, ...rest } = layout;
  return invoke("layout_save", { appId: app_id, ...rest });
}

export function layoutAll(): Promise<WindowLayoutDto[]> {
  return invoke("layout_all");
}

// ---------- GitHub ----------

export interface GhUser {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  public_repos: number;
  followers: number;
}

export interface GhRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  pushed_at: string | null;
  private: boolean;
}

export interface GhIssueItem {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: string;
  repository_url: string;
  pull_request?: unknown;
}

export interface GhSearchIssues {
  total_count: number;
  items: GhIssueItem[];
}

export interface GhCommit {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: { name: string | null; date: string | null } | null;
  };
}

export interface GithubStatus {
  connected: boolean;
  login: string | null;
}

export interface GithubOverview {
  user: GhUser;
  repos: GhRepo[];
  rate_remaining: number | null;
}

export function githubStatus(): Promise<GithubStatus> {
  return invoke("github_status");
}

/** Token vai UMA vez pro Rust, que valida e guarda no Credential Manager. */
export function githubConnect(token: string): Promise<GhUser> {
  return invoke("github_connect", { token });
}

export function githubDisconnect(): Promise<void> {
  return invoke("github_disconnect");
}

export function githubOverview(force = false): Promise<GithubOverview> {
  return invoke("github_overview", { force });
}

export function githubAssigned(force = false): Promise<GhSearchIssues> {
  return invoke("github_assigned", { force });
}

export function githubCommits(fullName: string, force = false): Promise<GhCommit[]> {
  return invoke("github_commits", { fullName, force });
}

// ---------- Foco (todos + pomodoro) ----------

export interface Todo {
  id: number;
  title: string;
  done: boolean;
  day: string;
  sort_order: number;
}

export interface PomodoroSession {
  id: number;
  kind: "focus" | "break";
  planned_min: number;
  started_at: number;
  ended_at: number | null;
  completed: boolean;
  todo_id: number | null;
}

export interface DayStat {
  day: string;
  focus_completed: number;
  focus_minutes: number;
}

export function todoList(day: string): Promise<Todo[]> {
  return invoke("todo_list", { day });
}

export function todoAdd(title: string, day: string): Promise<Todo> {
  return invoke("todo_add", { title, day });
}

export function todoToggle(id: number): Promise<boolean> {
  return invoke("todo_toggle", { id });
}

export function todoDelete(id: number): Promise<void> {
  return invoke("todo_delete", { id });
}

export function todoReorder(day: string, ids: number[]): Promise<void> {
  return invoke("todo_reorder", { day, ids });
}

export function todoCarryOver(fromDay: string, toDay: string): Promise<number> {
  return invoke("todo_carry_over", { fromDay, toDay });
}

export function pomodoroStart(
  kind: "focus" | "break",
  plannedMin: number,
  todoId?: number,
): Promise<number> {
  return invoke("pomodoro_start", { kind, plannedMin, todoId: todoId ?? null });
}

export function pomodoroFinish(id: number, completed: boolean): Promise<void> {
  return invoke("pomodoro_finish", { id, completed });
}

export function pomodoroOpenSession(): Promise<PomodoroSession | null> {
  return invoke("pomodoro_open_session");
}

export function pomodoroHistory(days: number): Promise<DayStat[]> {
  return invoke("pomodoro_history", { days });
}

// ---------- Quick links ----------

export interface QuickLinkDto {
  id: number;
  label: string;
  url: string;
  icon: string | null;
  sort_order: number;
}

export function quicklinkList(): Promise<QuickLinkDto[]> {
  return invoke("quicklink_list");
}

export function quicklinkAdd(label: string, url: string): Promise<QuickLinkDto> {
  return invoke("quicklink_add", { label, url, icon: null });
}

export function quicklinkDelete(id: number): Promise<void> {
  return invoke("quicklink_delete", { id });
}

// ---------- Wallpapers ----------

export interface WallpaperInfo {
  dir: string;
  files: string[];
}

export function wallpaperList(): Promise<WallpaperInfo> {
  return invoke("wallpaper_list");
}

/** Copia uma imagem escolhida no dialog nativo pra pasta de wallpapers. */
export function wallpaperImport(source: string): Promise<string> {
  return invoke("wallpaper_import", { source });
}

// ---------- Settings ----------

export function settingsGet(key: string): Promise<string | null> {
  return invoke("settings_get", { key });
}

export function settingsSet(key: string, value: string): Promise<void> {
  return invoke("settings_set", { key, value });
}
