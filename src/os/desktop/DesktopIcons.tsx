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

/** Encaixa uma posição solta na célula mais próxima da grade invisível. */
export function snapToGrid(x: number, y: number): { col: number; row: number } {
  return {
    col: Math.max(0, Math.round((x - GRID_X) / CELL_W)),
    row: Math.max(0, Math.round((y - GRID_Y) / CELL_H)),
  };
}

function cellToXY(col: number, row: number): { x: number; y: number } {
  return { x: GRID_X + col * CELL_W, y: GRID_Y + row * CELL_H };
}

function xyToCell(x: number, y: number): string {
  return `${Math.round((x - GRID_X) / CELL_W)},${Math.round((y - GRID_Y) / CELL_H)}`;
}

/** Primeira célula livre a partir de (col,row): desce a coluna, depois a próxima. */
function firstFreeCell(
  col: number,
  row: number,
  occupied: Set<string>,
): { x: number; y: number } {
  let c = col;
  let r = row;
  for (let step = 0; step < 200; step++) {
    if (!occupied.has(`${c},${r}`)) return cellToXY(c, r);
    r += 1;
    if (r >= PER_COLUMN) {
      r = 0;
      c += 1;
    }
  }
  return cellToXY(col, row);
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

  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  // Right-click no desktop vazio é capturado pelo Desktop root (este container
  // é pointer-events:none pra não bloquear as janelas) e chega via evento.
  useEffect(() => {
    function onContext(e: Event) {
      const { x, y } = (e as CustomEvent<{ x: number; y: number }>).detail;
      setMenu({ x, y });
    }
    window.addEventListener("olimpo:desktop-context", onContext);
    return () => window.removeEventListener("olimpo:desktop-context", onContext);
  }, []);

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

  const effectivePos = (key: string, i: number) =>
    positions[key] ?? defaultPos(i);

  function handleMoved(key: string, dropX: number, dropY: number) {
    // Células ocupadas pelos OUTROS ícones (resolve colisão no snap).
    const occupied = new Set<string>();
    entries.forEach((e, i) => {
      if (e.key === key) return;
      const p = effectivePos(e.key, i);
      occupied.add(xyToCell(p.x, p.y));
    });
    const { col, row } = snapToGrid(dropX, dropY);
    const free = firstFreeCell(col, row, occupied);
    persist({ ...positions, [key]: free });
  }

  /** Reorganiza tudo na grade limpa, na ordem natural dos ícones. */
  function organize() {
    const next: Positions = {};
    entries.forEach((e, i) => {
      next[e.key] = defaultPos(i);
    });
    persist(next);
    setMenu(null);
  }

  return (
    <div
      className="desktop-icons"
      onClick={() => {
        setSelected(null);
        setMenu(null);
      }}
    >
      {entries.map((entry, i) => (
        <DraggableIcon
          key={entry.key}
          entry={entry}
          pos={effectivePos(entry.key, i)}
          selected={selected === entry.key}
          onSelect={() => setSelected(entry.key)}
          onMoved={(x, y) => handleMoved(entry.key, x, y)}
        />
      ))}
      {menu && (
        <div
          className="desktop-icons__menu glass-strong"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={organize}>Organizar ícones</button>
        </div>
      )}
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
      // Reporta o ponto solto cru; o pai faz snap-to-grid + resolve colisão.
      onMoved(
        Math.max(0, pos.x + (e.clientX - d.startX)),
        Math.max(GRID_Y, pos.y + (e.clientY - d.startY)),
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
