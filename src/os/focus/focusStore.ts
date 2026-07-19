import { create } from "zustand";
import {
  pomodoroFinish,
  pomodoroOpenSession,
  pomodoroStart,
  settingsGet,
  settingsSet,
} from "../../lib/ipc";
import { breakForCycle, isDone } from "./engine";
import type { ActiveSession, SessionKind } from "./engine";
import { notify } from "./notify";

interface Durations {
  focus: number;
  break: number;
  longBreak: number;
}

export interface Technique {
  id: string;
  label: string;
  durations: Durations;
}

/** Técnicas de estudo prontas — pausa longa entra a cada 4 focos. */
export const TECHNIQUES: Technique[] = [
  { id: "classic", label: "25 · 5", durations: { focus: 25, break: 5, longBreak: 15 } },
  { id: "52-17", label: "52 · 17", durations: { focus: 52, break: 17, longBreak: 17 } },
  { id: "ultradian", label: "90 · 20", durations: { focus: 90, break: 20, longBreak: 30 } },
];

interface FocusStoreState {
  session: ActiveSession | null;
  durations: Durations;
  /** Overlay imersivo durante sessões de foco. */
  immersive: boolean;
  currentTodoId: number | null;
  /** Título da tarefa focada — vira o tópico dos post-its criados no estudo. */
  currentTodoTitle: string | null;
  hydrated: boolean;
  /** Focos completados no ciclo atual (persiste; pausa longa a cada 4). */
  cycleCount: number;

  restore: () => Promise<void>;
  start: (kind: SessionKind) => Promise<void>;
  cancel: () => Promise<void>;
  /** Chamado pelo ticker global ~1x/s; fecha ciclos vencidos. */
  settle: (now: number) => Promise<void>;
  setDurations: (d: Durations) => void;
  setImmersive: (on: boolean) => void;
  setCurrentTodo: (id: number | null, title?: string | null) => void;
}

const DEFAULTS: Durations = { focus: 25, break: 5, longBreak: 15 };

function clampDurations(d: Durations): Durations {
  return {
    focus: Math.min(180, Math.max(1, Math.round(d.focus) || DEFAULTS.focus)),
    break: Math.min(60, Math.max(1, Math.round(d.break) || DEFAULTS.break)),
    longBreak: Math.min(
      60,
      Math.max(1, Math.round(d.longBreak) || DEFAULTS.longBreak),
    ),
  };
}

export const useFocusStore = create<FocusStoreState>((set, get) => ({
  session: null,
  durations: DEFAULTS,
  immersive: false,
  currentTodoId: null,
  currentTodoTitle: null,
  hydrated: false,
  cycleCount: 0,

  restore: async () => {
    if (get().hydrated) return;
    set({ hydrated: true });
    try {
      const [focusMin, breakMin, longMin, immersive, cycle] = await Promise.all([
        settingsGet("pomodoro_focus_min"),
        settingsGet("pomodoro_break_min"),
        settingsGet("pomodoro_long_min"),
        settingsGet("focus_immersive"),
        settingsGet("pomodoro_cycle"),
      ]);
      set({
        durations: clampDurations({
          focus: Number(focusMin) || DEFAULTS.focus,
          break: Number(breakMin) || DEFAULTS.break,
          longBreak: Number(longMin) || DEFAULTS.longBreak,
        }),
        immersive: immersive === "1",
        cycleCount: Math.max(0, Number(cycle) || 0),
      });

      const open = await pomodoroOpenSession();
      if (!open) return;
      const session: ActiveSession = {
        dbId: open.id,
        kind: open.kind,
        startedAt: open.started_at,
        plannedMin: open.planned_min,
        todoId: open.todo_id,
      };
      if (isDone(session, Date.now())) {
        // Correu o tempo todo com o app fechado: conta como completa.
        await pomodoroFinish(session.dbId, true).catch(() => {});
      } else {
        set({ session, currentTodoId: open.todo_id });
      }
    } catch {
      // Fora do Tauri: segue com defaults, sem sessão.
    }
  },

  start: async (kind) => {
    const { durations, currentTodoId, session, cycleCount } = get();
    if (session) return;
    const plannedMin =
      kind === "focus"
        ? durations.focus
        : breakForCycle(cycleCount) === "long"
          ? durations.longBreak
          : durations.break;
    const todoId = kind === "focus" ? currentTodoId : null;
    const dbId = await pomodoroStart(kind, plannedMin, todoId ?? undefined);
    set({
      session: {
        dbId,
        kind,
        startedAt: Date.now(),
        plannedMin,
        todoId,
      },
    });
  },

  cancel: async () => {
    const { session } = get();
    if (!session) return;
    set({ session: null });
    await pomodoroFinish(session.dbId, false).catch(() => {});
  },

  settle: async (now) => {
    const { session } = get();
    if (!session || !isDone(session, now)) return;
    // Limpa antes do await: ticker roda de novo em 1s e não pode duplicar.
    set({ session: null });
    await pomodoroFinish(session.dbId, true).catch(() => {});

    if (session.kind === "focus") {
      const cycleCount = get().cycleCount + 1;
      set({ cycleCount });
      settingsSet("pomodoro_cycle", String(cycleCount)).catch(() => {});
      const long = breakForCycle(cycleCount) === "long";
      notify(
        "Foco completo ⚡",
        long ? "4 ciclos fechados — pausa LONGA merecida." : "Boa. Pausa curta agora.",
      );
      await get().start("break").catch(() => {});
    } else {
      notify("Pausa encerrada", "Pronto para o próximo foco?");
    }
  },

  setDurations: (d) => {
    const durations = clampDurations(d);
    set({ durations });
    settingsSet("pomodoro_focus_min", String(durations.focus)).catch(() => {});
    settingsSet("pomodoro_break_min", String(durations.break)).catch(() => {});
    settingsSet("pomodoro_long_min", String(durations.longBreak)).catch(() => {});
  },

  setImmersive: (on) => {
    set({ immersive: on });
    settingsSet("focus_immersive", on ? "1" : "0").catch(() => {});
  },

  setCurrentTodo: (id, title) =>
    set({ currentTodoId: id, currentTodoTitle: title ?? null }),
}));

/** Ticker global único — inicia no Desktop; 1s de resolução basta. */
export function startFocusTicker(): () => void {
  const timer = window.setInterval(() => {
    void useFocusStore.getState().settle(Date.now());
  }, 1000);
  return () => window.clearInterval(timer);
}
