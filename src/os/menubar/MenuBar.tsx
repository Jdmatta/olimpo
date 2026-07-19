import { useEffect, useRef, useState } from "react";
import { Mountain, NotebookPen } from "lucide-react";
import { createSticky } from "../desktop/createSticky";
import { useWindowStore } from "../window-manager/store";
import PomodoroChip from "./PomodoroChip";
import "./menubar.css";

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

async function quitApp() {
  try {
    const { appQuit } = await import("../../lib/ipc");
    await appQuit();
  } catch {
    // Fora do Tauri (dev no browser): não há o que fechar.
  }
}

function MenuBar() {
  const open = useWindowStore((s) => s.open);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const now = useClock();

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: PointerEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [menuOpen]);

  const time = now.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const date = now.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <header className="menubar glass-strong">
      <div className="menubar__left" ref={menuRef}>
        <button
          className={`menubar__logo ${menuOpen ? "menubar__logo--active" : ""}`}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <Mountain size={15} strokeWidth={1.8} />
          <span className="menubar__brand">Olimpo</span>
        </button>

        {menuOpen && (
          <div className="menubar__menu glass-strong glass-sheen">
            <button
              className="menubar__menu-item"
              onClick={() => {
                open("about");
                setMenuOpen(false);
              }}
            >
              Sobre o Olimpo
            </button>
            <button
              className="menubar__menu-item"
              onClick={() => {
                open("settings");
                setMenuOpen(false);
              }}
            >
              Ajustes…
            </button>
            <button
              className="menubar__menu-item"
              onClick={() => {
                window.dispatchEvent(new Event("olimpo:check-updates"));
                setMenuOpen(false);
              }}
            >
              Buscar atualizações…
            </button>
            <div className="menubar__separator" />
            <button className="menubar__menu-item" onClick={quitApp}>
              Encerrar Olimpo
            </button>
          </div>
        )}
      </div>

      <div className="menubar__right">
        <button
          className="menubar__tool"
          title="Novo post-it"
          onClick={() => void createSticky().catch(() => {})}
        >
          <NotebookPen size={14} strokeWidth={1.8} />
        </button>
        <PomodoroChip />
        <span className="menubar__date">{date}</span>
        <span className="menubar__time">{time}</span>
      </div>
    </header>
  );
}

export default MenuBar;
