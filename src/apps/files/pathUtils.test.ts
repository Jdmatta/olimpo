import { describe, expect, it } from "vitest";
import { crumbsFor, formatModified, formatSize } from "./pathUtils";

const ROOT = "C:\\Users\\PC\\Documents\\Trabalhos Programacao";

describe("crumbsFor", () => {
  it("raiz vira uma migalha só", () => {
    expect(crumbsFor(ROOT, ROOT)).toEqual([
      { label: "Trabalhos Programacao", path: ROOT },
    ]);
  });

  it("subpastas viram migalhas encadeadas", () => {
    const crumbs = crumbsFor(ROOT, `${ROOT}\\olimpo\\src`);
    expect(crumbs.map((c) => c.label)).toEqual([
      "Trabalhos Programacao",
      "olimpo",
      "src",
    ]);
    expect(crumbs[2].path).toBe(`${ROOT}\\olimpo\\src`);
  });

  it("caminho fora da raiz degrada para a raiz", () => {
    expect(crumbsFor(ROOT, "C:\\Windows")).toHaveLength(1);
  });
});

describe("formatSize", () => {
  it("pasta não tem tamanho", () => {
    expect(formatSize(4096, true)).toBe("—");
  });
  it("escala unidades", () => {
    expect(formatSize(512, false)).toBe("512 B");
    expect(formatSize(2048, false)).toBe("2.0 KB");
    expect(formatSize(5 * 1024 * 1024, false)).toBe("5.0 MB");
  });
});

describe("formatModified", () => {
  it("timestamp zero/ausente vira travessão", () => {
    expect(formatModified(0)).toBe("—");
  });

  it("formata uma data real em pt-BR", () => {
    const ms = new Date(2026, 0, 15).getTime();
    expect(formatModified(ms)).toBe("15 de jan. de 2026");
  });
});
