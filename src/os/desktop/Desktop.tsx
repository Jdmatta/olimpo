import { useEffect } from "react";
import Wallpaper from "./Wallpaper";
import WindowLayer from "../window-manager/WindowLayer";
import MenuBar from "../menubar/MenuBar";
import Dock from "../dock/Dock";
import { useWindowStore } from "../window-manager/store";

function Desktop() {
  // DEV: abre uma janela ao iniciar para inspecionar o shell sem cliques.
  useEffect(() => {
    if (import.meta.env.DEV) {
      useWindowStore.getState().open("about");
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
