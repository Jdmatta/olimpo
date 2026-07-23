import { describe, expect, it } from "vitest";
import {
  computeLayout,
  firstFreeCell,
  maxColFor,
  resolveDrag,
  snapToGrid,
} from "./DesktopIcons";

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

  it("reclamp: coluna salva além do maxCol volta pra dentro da tela", () => {
    // ícone salvo na coluna 8; tela só comporta até a coluna 2
    const saved = { a: { x: 22 + 8 * 86, y: 52 } };
    const l = computeLayout(["a"], saved, 2);
    expect(l.a.col).toBeLessThanOrEqual(2);
  });
});

describe("firstFreeCell — quem cede é o ícone arrastado", () => {
  it("soltar em célula ocupada empurra o PRÓPRIO (drop) pra próxima livre", () => {
    // B parado em (0,1). Arrasto A e solto em cima de (0,1).
    const occupied = new Set(["0,1"]);
    const free = firstFreeCell(0, 1, occupied);
    // A (arrastado) cede → (0,2); B fica onde estava
    expect(free).toEqual({ col: 0, row: 2 });
  });

  it("faz wrap de coluna quando a coluna enche", () => {
    const occupied = new Set(["0,5", "0,6"]);
    const free = firstFreeCell(0, 5, occupied);
    expect(free).toEqual({ col: 1, row: 0 });
  });

  it("célula livre retorna ela mesma", () => {
    expect(firstFreeCell(2, 3, new Set())).toEqual({ col: 2, row: 3 });
  });
});

describe("resolveDrag — puro, deriva de prev (mata a race de closure stale)", () => {
  const keys = ["a", "b", "c"];

  it("arrastado cede; vizinhos ficam (não reflowam)", () => {
    // estado inicial reflow: a(0,0) b(0,1) c(0,2). Arrasto 'a' sobre (0,1).
    const next = resolveDrag({}, keys, "a", 0, 1, 10);
    const L = computeLayout(keys, next, 10);
    expect(L.b).toEqual({ col: 0, row: 1 }); // b não se moveu
    expect(L.c).toEqual({ col: 0, row: 2 }); // c não se moveu
    expect(L.a).not.toEqual({ col: 0, row: 0 }); // a cedeu
    const cells = Object.values(L).map((p) => `${p.col},${p.row}`);
    expect(new Set(cells).size).toBe(cells.length); // sem colisão
  });

  it("dois drags sequenciais SEM re-render não perdem a 1ª jogada", () => {
    // drag 1: 'a' pra bem embaixo (row 5)
    const p1 = resolveDrag({}, keys, "a", 0, 5, 10);
    const aAfter1 = computeLayout(keys, p1, 10).a;
    // drag 2 usa p1 (o prev fresco) — simula 2º pointerup antes do re-render
    const p2 = resolveDrag(p1, keys, "b", 1, 0, 10);
    const aAfter2 = computeLayout(keys, p2, 10).a;
    // a jogada de 'a' sobreviveu ao 2º drag (não voltou pro topo)
    expect(aAfter2).toEqual(aAfter1);
    expect(aAfter2.row).toBe(5);
  });

  it("clampa a coluna do drop contra maxCol", () => {
    const next = resolveDrag({}, keys, "a", 99, 0, 2);
    const L = computeLayout(keys, next, 2);
    expect(L.a.col).toBeLessThanOrEqual(2);
  });
});

describe("maxColFor", () => {
  it("largura maior comporta mais colunas", () => {
    expect(maxColFor(400)).toBeLessThan(maxColFor(1920));
    expect(maxColFor(1920)).toBeGreaterThan(0);
  });
  it("largura minúscula não vira negativo", () => {
    expect(maxColFor(50)).toBe(0);
  });
});
