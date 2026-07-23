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
export function firstFreeCell(
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
  maxCol = Infinity,
): Record<string, Cell> {
  const occupied = new Set<string>();
  const layout: Record<string, Cell> = {};
  const clampCol = (c: number) => Math.max(0, Math.min(c, maxCol));

  const validSaved = (key: string): Cell | null => {
    const p = positions[key];
    if (!p || typeof p.x !== "number" || typeof p.y !== "number") return null;
    if (Number.isNaN(p.x) || Number.isNaN(p.y)) return null;
    const s = snapToGrid(p.x, p.y);
    // Reclamp contra a largura atual: posição salva numa tela maior não pode
    // deixar o ícone fora da área visível numa tela/janela menor.
    return { col: clampCol(s.col), row: s.row };
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

/** Máxima coluna que cabe na largura dada (sem o ícone sair da tela). */
export function maxColFor(width: number): number {
  return Math.max(0, Math.floor((width - GRID_X - CELL_W) / CELL_W));
}

function cellToXY(cell: Cell): { x: number; y: number } {
  return { x: GRID_X + cell.col * CELL_W, y: GRID_Y + cell.row * CELL_H };
}

/**
 * Resolve um drop de forma PURA a partir do estado `prev` mais recente — nunca
 * de um `layout` do closure (que pode estar stale entre dois drags rápidos).
 * O ícone arrastado vai pra 1ª célula livre; os demais são congelados na posição
 * efetiva atual (derivada de `prev`), pra ninguém reflowar/subir.
 */
export function resolveDrag(
  prev: Positions,
  keys: string[],
  key: string,
  dropCol: number,
  dropRow: number,
  maxCol: number,
): Positions {
  const cur = computeLayout(keys, prev, maxCol);
  const occupied = new Set<string>();
  for (const k of keys) {
    if (k === key) continue;
    const c = cur[k];
    if (c) occupied.add(cellKey(c.col, c.row));
  }
  const free = firstFreeCell(Math.min(dropCol, maxCol), dropRow, occupied);
  const next = { ...prev };
  for (const k of keys) {
    const c = k === key ? free : cur[k];
    if (c) next[k] = cellToXY(c);
  }
  return next;
}

/** Ícones da área de trabalho — arrastáveis, posição persistida; dblclick abre. */
function DesktopIcons() {
  const openWindow = useWindowStore((s) => s.open);
  const [extapps, setExtapps] = useState<ExternalApp[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [positions, setPositions] = useState<Positions>({});
  const [viewportW, setViewportW] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1920,
  );
  const saveTimer = useRef<number | undefined>(undefined);
  // Só persiste depois de carregar do disco — evita gravar {} por cima do salvo.
  const hydrated = useRef(false);
  // Último JSON gravado — evita re-gravar o mesmo valor (ex.: no pós-boot).
  const lastPersisted = useRef<string | null>(null);

  useEffect(() => {
    const load = () =>
      extappList()
        .then(setExtapps)
        .catch(() => {});
    load();
    settingsGet("desktop_icon_pos")
      .then((raw) => {
        if (raw) {
          try {
            const parsed: unknown = JSON.parse(raw);
            if (parsed && typeof parsed === "object") {
              setPositions(parsed as Positions);
              // Marca como já persistido pra o efeito não re-gravar no boot.
              lastPersisted.current = JSON.stringify(parsed);
            }
          } catch {
            // JSON corrompido: ignora e volta pro grid default
          }
        }
        hydrated.current = true;
      })
      .catch(() => {
        hydrated.current = true;
      });
    window.addEventListener("olimpo:extapps-changed", load);
    return () => window.removeEventListener("olimpo:extapps-changed", load);
  }, []);

  // Reclamp em resize: só força re-render (computeLayout usa viewportW).
  useEffect(() => {
    let t: number | undefined;
    const onResize = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => setViewportW(window.innerWidth), 150);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // Persiste como EFEITO de `positions` mudar — fora do updater do setState,
  // então não depende do clearTimeout neutralizar o double-invoke do StrictMode.
  useEffect(() => {
    if (!hydrated.current) return;
    const json = JSON.stringify(positions);
    if (json === lastPersisted.current) return; // não regrava valor idêntico
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      lastPersisted.current = json;
      settingsSet("desktop_icon_pos", json).catch(() => {});
    }, 500);
    return () => window.clearTimeout(saveTimer.current);
  }, [positions]);

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

  // Layout sem empilhamento, recomputado quando ícones, posições ou largura mudam.
  const keySig = entries.map((e) => e.key).join("|");
  const maxCol = maxColFor(viewportW);
  const layout = useMemo(
    () => computeLayout(keySig.split("|").filter(Boolean), positions, maxCol),
    [keySig, positions, maxCol],
  );

  function handleMoved(key: string, dropX: number, dropY: number) {
    const snapped = snapToGrid(dropX, dropY);
    const mc = maxColFor(window.innerWidth);
    const keys = entries.map((e) => e.key);
    // resolveDrag deriva TUDO de `prev` (fresco) dentro do updater — dois drags
    // rápidos antes do re-render não se atropelam (era o buraco do `layout` stale).
    setPositions((prev) => resolveDrag(prev, keys, key, snapped.col, snapped.row, mc));
  }

  /** Reorganiza tudo na grade limpa: zera posições → computeLayout preenche. */
  function organize() {
    setPositions({});
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
