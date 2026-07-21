import { useEffect, useMemo, useRef, useState } from "react";
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


/**
 * Encaixa uma posição solta na célula mais próxima da grade invisível.
 * `row` é clampado em [0, PER_COLUMN-1] pra nunca criar linha órfã fora da grade.
 */
export function snapToGrid(x: number, y: number): { col: number; row: number } {
  return {
    col: Math.max(0, Math.round((x - GRID_X) / CELL_W)),
    row: Math.min(PER_COLUMN - 1, Math.max(0, Math.round((y - GRID_Y) / CELL_H))),
  };
}

function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}

/** Primeira célula livre a partir de (col,row): desce a coluna, depois a próxima. */
function firstFreeCell(
  col: number,
  row: number,
  occupied: Set<string>,
): { col: number; row: number } {
  let c = Math.max(0, col);
  let r = Math.min(PER_COLUMN - 1, Math.max(0, row));
  // Limite generoso; com poucos ícones nunca chega perto.
  for (let step = 0; step < 5000; step++) {
    if (!occupied.has(cellKey(c, r))) return { col: c, row: r };
    r += 1;
    if (r >= PER_COLUMN) {
      r = 0;
      c += 1;
    }
  }
  return { col: c, row: r };
}

interface Cell {
  col: number;
  row: number;
}

/**
 * Layout efetivo de TODOS os ícones, sem empilhamento — resolvido no render,
 * não só no drop. Salvos (com shape válido) ocupam suas células primeiro (com
 * snap+colisão entre si); os sem posição preenchem as primeiras células livres,
 * na ordem de `entries`. Assim, reordenar `entries` (add/remove de app externo)
 * nunca faz dois ícones caírem na mesma célula.
 */
export function computeLayout(
  keys: string[],
  positions: Positions,
): Record<string, Cell> {
  const occupied = new Set<string>();
  const layout: Record<string, Cell> = {};

  const validSaved = (key: string): Cell | null => {
    const p = positions[key];
    if (!p || typeof p.x !== "number" || typeof p.y !== "number") return null;
    if (Number.isNaN(p.x) || Number.isNaN(p.y)) return null;
    return snapToGrid(p.x, p.y);
  };

  for (const key of keys) {
    const saved = validSaved(key);
    if (!saved) continue;
    const cell = firstFreeCell(saved.col, saved.row, occupied);
    layout[key] = cell;
    occupied.add(cellKey(cell.col, cell.row));
  }
  for (const key of keys) {
    if (layout[key]) continue;
    const cell = firstFreeCell(0, 0, occupied);
    layout[key] = cell;
    occupied.add(cellKey(cell.col, cell.row));
  }
  return layout;
}

function cellToXY(cell: Cell): { x: number; y: number } {
  return { x: GRID_X + cell.col * CELL_W, y: GRID_Y + cell.row * CELL_H };
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

  // Só agenda a gravação (debounce). O state é atualizado pelo caller via
  // setPositions funcional — evita ler `positions` stale.
  function schedulePersist(next: Positions) {
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

  // Layout sem empilhamento, recomputado quando ícones ou posições mudam.
  const layout = useMemo(
    () => computeLayout(entries.map((e) => e.key), positions),
    [entries.map((e) => e.key).join("|"), positions],
  );

  function handleMoved(key: string, dropX: number, dropY: number) {
    const { col, row } = snapToGrid(dropX, dropY);
    // Clamp de coluna contra a largura atual: ícone nunca cai fora da tela.
    const maxCol = Math.max(
      0,
      Math.floor((window.innerWidth - GRID_X - CELL_W) / CELL_W),
    );
    const cell = cellToXY({ col: Math.min(col, maxCol), row });
    // Updater funcional: nunca lê `positions` stale (mata a race de drops
    // seguidos). computeLayout resolve se a célula colidir com outro ícone.
    setPositions((prev) => {
      const next = { ...prev, [key]: cell };
      schedulePersist(next);
      return next;
    });
  }

  /** Reorganiza tudo na grade limpa: zera posições → computeLayout preenche. */
  function organize() {
    setPositions({});
    schedulePersist({});
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
      {entries.map((entry) => {
        const pos = cellToXY(layout[entry.key] ?? { col: 0, row: 0 });
        return (
          <DraggableIcon
            key={entry.key}
            entry={entry}
            pos={pos}
            selected={selected === entry.key}
            onSelect={() => setSelected(entry.key)}
            onMoved={(x, y) => handleMoved(entry.key, x, y)}
          />
        );
      })}
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
