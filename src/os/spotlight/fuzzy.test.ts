import { describe, expect, it } from "vitest";
import { fuzzyScore, rankItems } from "./fuzzy";

describe("fuzzyScore", () => {
  it("não casa quando falta letra", () => {
    expect(fuzzyScore("xyz", "terminal")).toBeNull();
    expect(fuzzyScore("terminal!", "terminal")).toBeNull();
  });

  it("casa subsequência ignorando caixa", () => {
    expect(fuzzyScore("TER", "terminal")).not.toBeNull();
    expect(fuzzyScore("tml", "terminal")).not.toBeNull();
  });

  it("prefixo pontua mais que subsequência espalhada", () => {
    const prefix = fuzzyScore("ter", "terminal")!;
    const scattered = fuzzyScore("tml", "terminal")!;
    expect(prefix).toBeGreaterThan(scattered);
  });

  it("início de palavra pontua mais que meio de palavra", () => {
    const wordStart = fuzzyScore("foco", "modo foco")!;
    const mid = fuzzyScore("foco", "desfocado")!;
    expect(wordStart).toBeGreaterThan(mid);
  });

  it("query vazia casa com score neutro", () => {
    expect(fuzzyScore("", "qualquer")).toBe(0);
  });
});

describe("rankItems", () => {
  const apps = ["Terminal", "Arquivos", "GitHub", "Foco", "Ajustes"];

  it("ordena por score e limita", () => {
    const ranked = rankItems("a", apps, (s) => s, 3);
    expect(ranked).toHaveLength(3);
    // Empate de prefixo 'A': desempata pelo alvo mais curto.
    expect(ranked[0].item).toBe("Ajustes");
    expect(ranked[1].item).toBe("Arquivos");
  });

  it("'ter' encontra Terminal em primeiro", () => {
    const ranked = rankItems("ter", apps, (s) => s);
    expect(ranked[0]?.item).toBe("Terminal");
  });

  it("query sem match vem vazia", () => {
    expect(rankItems("zzz", apps, (s) => s)).toHaveLength(0);
  });
});
