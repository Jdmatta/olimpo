/**
 * Motor do pomodoro — funções puras sobre timestamps (wall-clock).
 * NUNCA contar ticks de setInterval: o WebView2 throttla timers quando
 * a janela está oculta; a hora de parede não mente.
 */

export type SessionKind = "focus" | "break";

export interface ActiveSession {
  dbId: number;
  kind: SessionKind;
  startedAt: number;
  plannedMin: number;
  todoId: number | null;
}

export function plannedMs(session: ActiveSession): number {
  return session.plannedMin * 60_000;
}

export function elapsedMs(session: ActiveSession, now: number): number {
  return Math.max(0, now - session.startedAt);
}

export function remainingMs(session: ActiveSession, now: number): number {
  return Math.max(0, plannedMs(session) - elapsedMs(session, now));
}

export function isDone(session: ActiveSession, now: number): boolean {
  return remainingMs(session, now) === 0;
}

/** 0..1 — para o anel de progresso. */
export function progress(session: ActiveSession, now: number): number {
  const total = plannedMs(session);
  if (total === 0) return 1;
  return Math.min(1, elapsedMs(session, now) / total);
}

export function nextKind(kind: SessionKind): SessionKind {
  return kind === "focus" ? "break" : "focus";
}

/** mm:ss para o timer e o chip do menubar. */
export function formatRemaining(session: ActiveSession, now: number): string {
  const totalSeconds = Math.ceil(remainingMs(session, now) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
