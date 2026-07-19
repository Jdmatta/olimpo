import { describe, expect, it } from "vitest";
import { ACCENTS, GLASS_LEVELS, resolveAppearance } from "./appearance";

describe("resolveAppearance", () => {
  it("defaults quando settings vazias/nulas", () => {
    const t = resolveAppearance(null, null, null);
    expect(t.accent.id).toBe("louro");
    expect(t.glass.id).toBe("padrao");
    expect(t.reducedMotion).toBe(false);
  });

  it("resolve presets válidos", () => {
    const t = resolveAppearance("esmeralda", "denso", "1");
    expect(t.accent.bright).toBe("#8ee8c9");
    expect(t.glass.blur).toBe("42px");
    expect(t.reducedMotion).toBe(true);
  });

  it("valores inválidos degradam pro default", () => {
    const t = resolveAppearance("neon-hacker", "ultra", "sim");
    expect(t.accent.id).toBe("louro");
    expect(t.glass.id).toBe("padrao");
    expect(t.reducedMotion).toBe(false);
  });

  it("todos os presets têm cores hex válidas", () => {
    for (const a of ACCENTS) {
      expect(a.base).toMatch(/^#[0-9a-f]{6}$/i);
      expect(a.bright).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(GLASS_LEVELS).toHaveLength(3);
  });
});
