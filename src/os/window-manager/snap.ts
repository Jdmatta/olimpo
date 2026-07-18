import type { Rect } from "./types";

export type SnapZone = "left" | "right" | "top" | null;

const EDGE = 16;
const MENUBAR_H = 30;

/** Zona de snap para a posição do ponteiro durante o drag. */
export function zoneForPointer(
  x: number,
  y: number,
  vw: number,
): SnapZone {
  if (y <= MENUBAR_H + 6) return "top";
  if (x <= EDGE) return "left";
  if (x >= vw - EDGE) return "right";
  return null;
}

/** Rect alvo de cada zona (top = tela cheia sob o menubar). */
export function rectForZone(zone: Exclude<SnapZone, null>, vw: number, vh: number): Rect {
  const h = vh - MENUBAR_H;
  switch (zone) {
    case "top":
      return { x: 0, y: MENUBAR_H, w: vw, h };
    case "left":
      return { x: 0, y: MENUBAR_H, w: Math.floor(vw / 2), h };
    case "right": {
      const w = Math.ceil(vw / 2);
      return { x: vw - w, y: MENUBAR_H, w, h };
    }
  }
}
