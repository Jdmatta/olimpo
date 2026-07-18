import { useEffect } from "react";
import Wallpaper from "./Wallpaper";
import WindowLayer from "../window-manager/WindowLayer";
import MenuBar from "../menubar/MenuBar";
import Dock from "../dock/Dock";
import { useWindowStore } from "../window-manager/store";

function Desktop() {
  // DEV: abre o terminal ao iniciar para inspecionar o shell sem cliques.
  // Guard contra o double-effect do StrictMode (terminal é multi-instância).
  useEffect(() => {
    if (import.meta.env.DEV) {
      const store = useWindowStore.getState();
      if (Object.keys(store.windows).length === 0) {
        store.open("terminal");
      }
    }
  }, []);
  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <Wallpaper />
      <WindowLayer />
      <MenuBar />
      <Dock />
    </div>
  );
}

export default Desktop;
