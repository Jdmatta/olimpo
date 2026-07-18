import { describe, expect, it } from "vitest";
import {
  formatRemaining,
  isDone,
  nextKind,
  progress,
  remainingMs,
} from "./engine";
import type { ActiveSession } from "./engine";

const base: ActiveSession = {
  dbId: 1,
  kind: "focus",
  startedAt: 1_000_000,
  plannedMin: 25,
  todoId: null,
};

describe("engine do pomodoro (clock injetado)", () => {
  it("remaining conta a partir do timestamp, não de ticks", () => {
    expect(remainingMs(base, base.startedAt)).toBe(25 * 60_000);
    expect(remainingMs(base, base.startedAt + 60_000)).toBe(24 * 60_000);
    // Clock voltou (ajuste de hora): nunca estoura acima do planejado.
    expect(remainingMs(base, base.startedAt - 5_000)).toBe(25 * 60_000);
  });

  it("isDone vira exatamente no fim e permanece", () => {
    const end = base.startedAt + 25 * 60_000;
    expect(isDone(base, end - 1)).toBe(false);
    expect(isDone(base, end)).toBe(true);
    // App ficou fechado horas: continua done (restore usa isso).
    expect(isDone(base, end + 3 * 60 * 60_000)).toBe(true);
  });

  it("progress limita em 0..1", () => {
    expect(progress(base, base.startedAt)).toBe(0);
    expect(progress(base, base.startedAt + 12.5 * 60_000)).toBeCloseTo(0.5);
    expect(progress(base, base.startedAt + 60 * 60_000)).toBe(1);
  });

  it("ciclo focus→break→focus", () => {
    expect(nextKind("focus")).toBe("break");
    expect(nextKind("break")).toBe("focus");
  });

  it("formata mm:ss com padding", () => {
    expect(formatRemaining(base, base.startedAt)).toBe("25:00");
    expect(formatRemaining(base, base.startedAt + 24 * 60_000 + 51_000)).toBe("00:09");
    expect(formatRemaining(base, base.startedAt + 30 * 60_000)).toBe("00:00");
  });
});
