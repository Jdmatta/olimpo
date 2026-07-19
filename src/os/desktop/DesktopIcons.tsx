import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { listPinnedApps } from "../../apps/registry";
import { extappLaunch, extappList, settingsGet, settingsSet } from "../../lib/ipc";
import type { ExternalApp } from "../../lib/ipc";
import { extAppIcon } from "../dock/Dock";
import { useWindowStore } from "../window-manager/store";
import "./desktopicons.css";

interface IconEntry {
  key: string;
  label: string;
  icon: React.ReactNode;
  open: () => void;
}

type Positions = Record<string, { x: number; y: number }>;

const GRID_X = 22;
const GRID_Y = 52;
const CELL_H = 92;
const CELL_W = 86;
const PER_COLUMN = 7;
const DRAG_THRESHOLD = 6;

function defaultPos(index: number): { x: number; y: number } {
  return {
    x: GRID_X + Math.floor(index / PER_COLUMN) * CELL_W,
    y: GRID_Y + (index % PER_COLUMN) * CELL_H,
  };
}

/** Ícones da área de trabalho — arrastáveis, posição persistida; dblclick abre. */
function DesktopIcons() {
  const openWindow = useWindowStore((s) => s.open);
  const [extapps, setExtapps] = useState<ExternalApp[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [positions, setPositions] = useState<Positions>({});
  const saveTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const load = () =>
      extappList()
        .then(setExtapps)
        .catch(() => {});
    load();
    settingsGet("desktop_icon_pos")
      .then((raw) => {
        if (!raw) return;
        try {
          const parsed: unknown = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            setPositions(parsed as Positions);
          }
        } catch {
          // JSON corrompido: ignora e volta pro grid default
        }
      })
      .catch(() => {});
    window.addEventListener("olimpo:extapps-changed", load);
    return () => window.removeEventListener("olimpo:extapps-changed", load);
  }, []);

  function persist(next: Positions) {
    setPositions(next);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      settingsSet("desktop_icon_pos", JSON.stringify(next)).catch(() => {});
    }, 500);
  }

  const entries: IconEntry[] = [
    ...listPinnedApps().map((app) => ({
      key: `app:${app.id}`,
      label: app.title,
      icon: app.icon(30),
      open: () => openWindow(app.id),
    })),
    ...extapps.map((app) => ({
      key: `ext:${app.id}`,
      label: app.label,
      icon: extAppIcon(app.icon, 30),
      open: () => void extappLaunch(app.id).catch(() => {}),
    })),
  ];

  return (
    <div className="desktop-icons" onClick={() => setSelected(null)}>
      {entries.map((entry, i) => (
        <DraggableIcon
          key={entry.key}
          entry={entry}
          pos={positions[entry.key] ?? defaultPos(i)}
          selected={selected === entry.key}
          onSelect={() => setSelected(entry.key)}
          onMoved={(x, y) => persist({ ...positions, [entry.key]: { x, y } })}
        />
      ))}
    </div>
  );
}

function DraggableIcon({
  entry,
  pos,
  selected,
  onSelect,
  onMoved,
}: {
  entry: IconEntry;
  pos: { x: number; y: number };
  selected: boolean;
  onSelect: () => void;
  onMoved: (x: number, y: number) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ startX: number; startY: number; moved: boolean } | null>(null);

  function onDown(e: ReactPointerEvent) {
    drag.current = { startX: e.clientX, startY: e.clientY, moved: false };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onMove(e: ReactPointerEvent) {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    // Threshold: clique/dblclick não viram drag por 2px de tremida.
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    d.moved = true;
    el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
  }
  function onUp(e: ReactPointerEvent) {
    const d = drag.current;
    const el = ref.current;
    drag.current = null;
    if (!d || !el) return;
    el.style.transform = "";
    if (d.moved) {
      onMoved(
        Math.max(0, pos.x + (e.clientX - d.startX)),
        Math.max(34, pos.y + (e.clientY - d.startY)),
      );
    }
  }

  return (
    <button
      ref={ref}
      className={`desktop-icon ${selected ? "desktop-icon--selected" : ""}`}
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onDoubleClick={() => entry.open()}
    >
      <span className="desktop-icon__glyph glass-soft">{entry.icon}</span>
      <span className="desktop-icon__label">{entry.label}</span>
    </button>
  );
}

export default DesktopIcons;
