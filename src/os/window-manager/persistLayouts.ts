import { layoutAll, layoutSave } from "../../lib/ipc";
import { useWindowStore } from "./store";
import type { AppId } from "./types";

/**
 * Persistência de layout por app (last-writer-wins para multi-instância).
 * Fora do Tauri (vite puro) o IPC falha — tudo aqui é fail-silent.
 */

const SAVE_DELAY_MS = 600;

export async function hydrateLayouts(): Promise<void> {
  try {
    const layouts = await layoutAll();
    useWindowStore.getState().hydrateLayouts(
      Object.fromEntries(
        layouts.map((l) => [
          l.app_id,
          { rect: { x: l.x, y: l.y, w: l.w, h: l.h }, maximized: l.maximized },
        ]),
      ),
    );
  } catch {
    // sem Tauri ou banco vazio: segue com defaults
  }
}

export function startLayoutPersistence(): () => void {
  const timers = new Map<AppId, number>();
  let last = useWindowStore.getState().windows;

  const unsubscribe = useWindowStore.subscribe((state) => {
    const windows = state.windows;
    if (windows === last) return;
    const prev = last;
    last = windows;

    for (const win of Object.values(windows)) {
      const before = prev[win.id];
      const changed =
        !before ||
        before.rect !== win.rect ||
        before.maximized !== win.maximized;
      if (!changed || win.minimized) continue;

      window.clearTimeout(timers.get(win.appId));
      const rect = win.maximized && win.prevRect ? win.prevRect : win.rect;
      const maximized = win.maximized;
      timers.set(
        win.appId,
        window.setTimeout(() => {
          layoutSave({
            app_id: win.appId,
            x: rect.x,
            y: rect.y,
            w: rect.w,
            h: rect.h,
            maximized,
          }).catch(() => {});
        }, SAVE_DELAY_MS),
      );
    }
  });

  return () => {
    unsubscribe();
    for (const t of timers.values()) window.clearTimeout(t);
  };
}
