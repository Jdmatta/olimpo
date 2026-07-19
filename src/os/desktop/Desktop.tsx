import { useEffect } from "react";
import Wallpaper from "./Wallpaper";
import DesktopIcons from "./DesktopIcons";
import WindowLayer from "../window-manager/WindowLayer";
import MenuBar from "../menubar/MenuBar";
import Dock from "../dock/Dock";
import FocusOverlay from "../focus/FocusOverlay";
import SnapPreview from "../window-manager/SnapPreview";
import Spotlight from "../spotlight/Spotlight";
import QuickLinks from "./QuickLinks";
import { startFocusTicker, useFocusStore } from "../focus/focusStore";
import { useWindowStore } from "../window-manager/store";
import {
  hydrateLayouts,
  startLayoutPersistence,
} from "../window-manager/persistLayouts";

function Desktop() {
  // F11: tela cheia de verdade (esconde a taskbar — vira "OS" mesmo).
  useEffect(() => {
    async function toggleFullscreen() {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const win = getCurrentWindow();
        if (await win.isFullscreen()) {
          await win.setFullscreen(false);
          await win.maximize();
        } else {
          // Fullscreen a partir de maximizada deixa faixa preta no Windows:
          // desmaximiza primeiro para o wry medir a tela inteira.
          await win.unmaximize();
          await win.setFullscreen(true);
        }
      } catch {
        // fora do Tauri: nada a fazer
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "F11") {
        e.preventDefault();
        void toggleFullscreen();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    let stopPersistence: (() => void) | undefined;
    let cancelled = false;

    const stopTicker = startFocusTicker();
    void useFocusStore.getState().restore();

    void hydrateLayouts().then(() => {
      if (cancelled) return;
      stopPersistence = startLayoutPersistence();
      // DEV: abre o terminal ao iniciar para inspecionar sem cliques.
      // Guard contra o double-effect do StrictMode.
      if (import.meta.env.DEV) {
        const store = useWindowStore.getState();
        if (Object.keys(store.windows).length === 0) {
          store.open("terminal");
        }
      }
    });

    return () => {
      cancelled = true;
      stopTicker();
      stopPersistence?.();
    };
  }, []);
  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <Wallpaper />
      <DesktopIcons />
      <QuickLinks />
      <SnapPreview />
      <WindowLayer />
      <MenuBar />
      <Dock />
      <Spotlight />
      <FocusOverlay />
    </div>
  );
}

export default Desktop;
