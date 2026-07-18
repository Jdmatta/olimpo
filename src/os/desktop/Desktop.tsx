import { useEffect } from "react";
import Wallpaper from "./Wallpaper";
import WindowLayer from "../window-manager/WindowLayer";
import MenuBar from "../menubar/MenuBar";
import Dock from "../dock/Dock";
import FocusOverlay from "../focus/FocusOverlay";
import { startFocusTicker, useFocusStore } from "../focus/focusStore";
import { useWindowStore } from "../window-manager/store";
import {
  hydrateLayouts,
  startLayoutPersistence,
} from "../window-manager/persistLayouts";

function Desktop() {
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
      <WindowLayer />
      <MenuBar />
      <Dock />
      <FocusOverlay />
    </div>
  );
}

export default Desktop;
