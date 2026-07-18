import { create } from "zustand";
import {
  pomodoroFinish,
  pomodoroOpenSession,
  pomodoroStart,
  settingsGet,
  settingsSet,
} from "../../lib/ipc";
import { isDone } from "./engine";
import type { ActiveSession, SessionKind } from "./engine";
import { notify } from "./notify";

interface Durations {
  focus: number;
  break: number;
}

interface FocusStoreState {
  session: ActiveSession | null;
  durations: Durations;
  /** Overlay imersivo durante sessões de foco. */
  immersive: boolean;
  currentTodoId: number | null;
  hydrated: boolean;

  restore: () => Promise<void>;
  start: (kind: SessionKind) => Promise<void>;
  cancel: () => Promise<void>;
  /** Chamado pelo ticker global ~1x/s; fecha ciclos vencidos. */
  settle: (now: number) => Promise<void>;
  setDurations: (d: Durations) => void;
  setImmersive: (on: boolean) => void;
  setCurrentTodo: (id: number | null) => void;
}

const DEFAULTS: Durations = { focus: 25, break: 5 };

function clampDurations(d: Durations): Durations {
  return {
    focus: Math.min(180, Math.max(1, Math.round(d.focus) || DEFAULTS.focus)),
    break: Math.min(60, Math.max(1, Math.round(d.break) || DEFAULTS.break)),
  };
}

export const useFocusStore = create<FocusStoreState>((set, get) => ({
  session: null,
  durations: DEFAULTS,
  immersive: false,
  currentTodoId: null,
  hydrated: false,

  restore: async () => {
    if (get().hydrated) return;
    set({ hydrated: true });
    try {
      const [focusMin, breakMin, immersive] = await Promise.all([
        settingsGet("pomodoro_focus_min"),
        settingsGet("pomodoro_break_min"),
        settingsGet("focus_immersive"),
      ]);
      set({
        durations: clampDurations({
          focus: Number(focusMin) || DEFAULTS.focus,
          break: Number(breakMin) || DEFAULTS.break,
        }),
        immersive: immersive === "1",
      });

      const open = await pomodoroOpenSession();
      if (!open) return;
      const session: ActiveSession = {
        dbId: open.id,
        kind: open.kind,
        startedAt: open.started_at,
        plannedMin: open.planned_min,
        todoId: null,
      };
      if (isDone(session, Date.now())) {
        // Correu o tempo todo com o app fechado: conta como completa.
        await pomodoroFinish(session.dbId, true).catch(() => {});
      } else {
        set({ session });
      }
    } catch {
      // Fora do Tauri: segue com defaults, sem sessão.
    }
  },

  start: async (kind) => {
    const { durations, currentTodoId, session } = get();
    if (session) return;
    const plannedMin = kind === "focus" ? durations.focus : durations.break;
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
      notify("Foco completo ⚡", "Boa. Pausa curta agora.");
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
  },

  setImmersive: (on) => {
    set({ immersive: on });
    settingsSet("focus_immersive", on ? "1" : "0").catch(() => {});
  },

  setCurrentTodo: (id) => set({ currentTodoId: id }),
}));

/** Ticker global único — inicia no Desktop; 1s de resolução basta. */
export function startFocusTicker(): () => void {
  const timer = window.setInterval(() => {
    void useFocusStore.getState().settle(Date.now());
  }, 1000);
  return () => window.clearInterval(timer);
}
