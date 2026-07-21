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

  it("timestamp não-finito (NaN, Infinity) vira travessão", () => {
    // Infinity é truthy: passa pelo guard antigo e quebra em new Date(Infinity).
    expect(formatModified(NaN)).toBe("—");
    expect(formatModified(Infinity)).toBe("—");
  });

  it("formata data com dia de 2 dígitos e ano (robusto a locale)", () => {
    // dia 5 prova o zero-padding ("05", não "5"); \D+ tolera variação de
    // espaço/mês do ICU entre versões do Node — não compara string exata.
    const out = formatModified(new Date(2026, 0, 5).getTime());
    expect(out).toMatch(/^05\D+2026$/);
  });
});
