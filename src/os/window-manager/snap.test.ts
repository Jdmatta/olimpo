import { describe, expect, it } from "vitest";
import { rectForZone, zoneForPointer } from "./snap";

const VW = 1920;
const VH = 1080;

describe("zoneForPointer", () => {
  it("bordas viram zonas; centro não", () => {
    expect(zoneForPointer(5, 500, VW)).toBe("left");
    expect(zoneForPointer(VW - 3, 500, VW)).toBe("right");
    expect(zoneForPointer(900, 20, VW)).toBe("top");
    expect(zoneForPointer(900, 500, VW)).toBeNull();
  });

  it("topo tem prioridade sobre cantos", () => {
    expect(zoneForPointer(2, 10, VW)).toBe("top");
  });
});

describe("rectForZone", () => {
  it("metades cobrem a tela inteira sem sobrar pixel", () => {
    const left = rectForZone("left", VW, VH);
    const right = rectForZone("right", VW, VH);
    expect(left.x).toBe(0);
    expect(right.x + right.w).toBe(VW);
    expect(left.w + right.w).toBeGreaterThanOrEqual(VW);
    expect(left.y).toBe(30);
    expect(left.h).toBe(VH - 30);
  });

  it("largura ímpar não deixa buraco", () => {
    const left = rectForZone("left", 1001, VH);
    const right = rectForZone("right", 1001, VH);
    expect(left.w + right.w).toBeGreaterThanOrEqual(1001);
  });

  it("top ocupa tudo sob o menubar", () => {
    expect(rectForZone("top", VW, VH)).toEqual({ x: 0, y: 30, w: VW, h: VH - 30 });
  });
});
