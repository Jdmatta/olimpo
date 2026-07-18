import { create } from "zustand";
import type { AppId, Rect, WindowPayload, WindowState } from "./types";
import { getAppMeta } from "../../apps/registry";

interface WindowManagerState {
  windows: Record<string, WindowState>;
  focusedId: string | null;
  nextZ: number;
  nextInstance: number;

  open: (appId: AppId, payload?: WindowPayload) => string;
  close: (id: string) => void;
  focus: (id: string) => void;
  setRect: (id: string, rect: Rect) => void;
  minimize: (id: string) => void;
  /** Reabre/foca um app a partir do dock. */
  activateApp: (appId: AppId) => void;
  toggleMaximize: (id: string) => void;
}

const CASCADE_STEP = 36;

function spawnRect(appId: AppId, instance: number): Rect {
  const { defaultSize } = getAppMeta(appId);
  const viewportW = typeof window !== "undefined" ? window.innerWidth : 1920;
  const viewportH = typeof window !== "undefined" ? window.innerHeight : 1080;
  const offset = (instance % 8) * CASCADE_STEP;
  return {
    x: Math.max(16, (viewportW - defaultSize.w) / 2 + offset),
    y: Math.max(46, (viewportH - defaultSize.h) / 2.4 + offset),
    w: defaultSize.w,
    h: defaultSize.h,
  };
}

export const useWindowStore = create<WindowManagerState>((set, get) => ({
  windows: {},
  focusedId: null,
  nextZ: 1,
  nextInstance: 0,

  open: (appId, payload) => {
    const state = get();
    const meta = getAppMeta(appId);

    if (!meta.multiInstance) {
      const existing = Object.values(state.windows).find(
        (w) => w.appId === appId,
      );
      if (existing) {
        if (existing.minimized) {
          set((s) => ({
            windows: {
              ...s.windows,
              [existing.id]: { ...existing, minimized: false, z: s.nextZ },
            },
            focusedId: existing.id,
            nextZ: s.nextZ + 1,
          }));
        } else {
          state.focus(existing.id);
        }
        return existing.id;
      }
    }

    const id = `${appId}-${state.nextInstance}`;
    const win: WindowState = {
      id,
      appId,
      rect: spawnRect(appId, state.nextInstance),
      z: state.nextZ,
      minimized: false,
      maximized: false,
      prevRect: null,
      payload,
    };
    set((s) => ({
      windows: { ...s.windows, [id]: win },
      focusedId: id,
      nextZ: s.nextZ + 1,
      nextInstance: s.nextInstance + 1,
    }));
    return id;
  },

  close: (id) => {
    set((s) => {
      const windows = { ...s.windows };
      delete windows[id];
      let focusedId = s.focusedId;
      if (focusedId === id) {
        const top = Object.values(windows)
          .filter((w) => !w.minimized)
          .sort((a, b) => b.z - a.z)[0];
        focusedId = top ? top.id : null;
      }
      return { windows, focusedId };
    });
  },

  focus: (id) => {
    set((s) => {
      const win = s.windows[id];
      if (!win || win.minimized) return s;
      if (s.focusedId === id) return s;
      return {
        windows: { ...s.windows, [id]: { ...win, z: s.nextZ } },
        focusedId: id,
        nextZ: s.nextZ + 1,
      };
    });
  },

  setRect: (id, rect) => {
    set((s) => {
      const win = s.windows[id];
      if (!win) return s;
      return { windows: { ...s.windows, [id]: { ...win, rect } } };
    });
  },

  minimize: (id) => {
    set((s) => {
      const win = s.windows[id];
      if (!win) return s;
      const windows = { ...s.windows, [id]: { ...win, minimized: true } };
      let focusedId = s.focusedId;
      if (focusedId === id) {
        const top = Object.values(windows)
          .filter((w) => !w.minimized && w.id !== id)
          .sort((a, b) => b.z - a.z)[0];
        focusedId = top ? top.id : null;
      }
      return { windows, focusedId };
    });
  },

  activateApp: (appId) => {
    const state = get();
    const wins = Object.values(state.windows).filter((w) => w.appId === appId);
    if (wins.length === 0) {
      state.open(appId);
      return;
    }
    const minimized = wins.filter((w) => w.minimized);
    if (minimized.length === wins.length) {
      // Tudo minimizado: restaura o mais recente.
      const target = minimized.sort((a, b) => b.z - a.z)[0];
      set((s) => ({
        windows: {
          ...s.windows,
          [target.id]: { ...target, minimized: false, z: s.nextZ },
        },
        focusedId: target.id,
        nextZ: s.nextZ + 1,
      }));
      return;
    }
    const top = wins
      .filter((w) => !w.minimized)
      .sort((a, b) => b.z - a.z)[0];
    state.focus(top.id);
  },

  toggleMaximize: (id) => {
    set((s) => {
      const win = s.windows[id];
      if (!win) return s;
      if (win.maximized) {
        return {
          windows: {
            ...s.windows,
            [id]: {
              ...win,
              maximized: false,
              rect: win.prevRect ?? win.rect,
              prevRect: null,
              z: s.nextZ,
            },
          },
          focusedId: id,
          nextZ: s.nextZ + 1,
        };
      }
      return {
        windows: {
          ...s.windows,
          [id]: { ...win, maximized: true, prevRect: win.rect, z: s.nextZ },
        },
        focusedId: id,
        nextZ: s.nextZ + 1,
      };
    });
  },
}));
