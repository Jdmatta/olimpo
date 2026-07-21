import { describe, expect, it } from "vitest";
import { computeLayout, snapToGrid } from "./DesktopIcons";

describe("snapToGrid", () => {
  it("posição solta encaixa na célula mais próxima", () => {
    // grade: GRID_X=22, GRID_Y=52, CELL_W=86, CELL_H=92, PER_COLUMN=7
    expect(snapToGrid(22, 52)).toEqual({ col: 0, row: 0 });
    expect(snapToGrid(108, 144)).toEqual({ col: 1, row: 1 });
    expect(snapToGrid(60, 55)).toEqual({ col: 0, row: 0 });
    expect(snapToGrid(80, 55)).toEqual({ col: 1, row: 0 });
  });

  it("nunca retorna célula negativa", () => {
    expect(snapToGrid(-500, -500)).toEqual({ col: 0, row: 0 });
  });

  it("row é clampado dentro da grade (não cria linha órfã)", () => {
    // y muito grande cairia em row > 6 sem o clamp
    const s = snapToGrid(22, 5000);
    expect(s.row).toBe(6); // PER_COLUMN - 1
    expect(s.col).toBe(0);
  });
});

describe("computeLayout — sem empilhamento", () => {
  it("dois ícones sem posição salva ocupam células distintas", () => {
    const l = computeLayout(["a", "b"], {});
    expect(l.a).toEqual({ col: 0, row: 0 });
    expect(l.b).toEqual({ col: 0, row: 1 });
  });

  it("ícone salvo colidindo com não-salvo NÃO empilha (bug do defaultPos)", () => {
    // 'a' salvo na célula (0,1); 'b' sem posição tentaria (0,1) por ordem.
    const savedXY = { x: 22, y: 52 + 92 }; // col 0, row 1
    const l = computeLayout(["a", "b"], { a: savedXY });
    expect(l.a).toEqual({ col: 0, row: 1 });
    // b não pode cair na mesma célula
    expect(l.b).not.toEqual(l.a);
  });

  it("dois salvos na MESMA célula: o segundo é empurrado", () => {
    const same = { x: 22, y: 52 };
    const l = computeLayout(["a", "b"], { a: same, b: same });
    expect(l.a).toEqual({ col: 0, row: 0 });
    expect(l.b).not.toEqual({ col: 0, row: 0 });
  });

  it("posição corrompida (não-numérica ou NaN) é ignorada, sem NaN no layout", () => {
    const l = computeLayout(["a", "b"], {
      a: { x: NaN, y: 10 },
      b: { x: "oops" as unknown as number, y: 10 },
    });
    for (const cell of [l.a, l.b]) {
      expect(Number.isFinite(cell.col)).toBe(true);
      expect(Number.isFinite(cell.row)).toBe(true);
    }
  });

  it("reordenar as keys não gera colisão", () => {
    const saved = { c: { x: 22, y: 52 } }; // c fixo em (0,0)
    const l1 = computeLayout(["a", "b", "c"], saved);
    const l2 = computeLayout(["x", "y", "a", "b", "c"], saved);
    // c mantém sua célula salva nos dois; ninguém empilha
    expect(l2.c).toEqual({ col: 0, row: 0 });
    const cells = Object.values(l2).map((p) => `${p.col},${p.row}`);
    expect(new Set(cells).size).toBe(cells.length);
    expect(l1.c).toEqual(l2.c);
  });
});
