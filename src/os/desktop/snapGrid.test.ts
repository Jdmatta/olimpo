import { describe, expect, it } from "vitest";
import { snapToGrid } from "./DesktopIcons";

describe("snapToGrid", () => {
  it("posição solta encaixa na célula mais próxima", () => {
    // grade: GRID_X=22, GRID_Y=52, CELL_W=86, CELL_H=92
    expect(snapToGrid(22, 52)).toEqual({ col: 0, row: 0 });
    expect(snapToGrid(108, 144)).toEqual({ col: 1, row: 1 });
    // 60px de x → mais perto da coluna 0 (22) que da 1 (108)
    expect(snapToGrid(60, 55)).toEqual({ col: 0, row: 0 });
    // 80px → arredonda pra coluna 1
    expect(snapToGrid(80, 55)).toEqual({ col: 1, row: 0 });
  });

  it("nunca retorna célula negativa", () => {
    expect(snapToGrid(-500, -500)).toEqual({ col: 0, row: 0 });
  });
});
