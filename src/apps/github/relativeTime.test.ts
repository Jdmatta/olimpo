import { describe, expect, it } from "vitest";
import { relativeTime, repoFromUrl } from "./relativeTime";

const NOW = Date.parse("2026-07-18T12:00:00Z");

describe("relativeTime", () => {
  it("faixas principais", () => {
    expect(relativeTime("2026-07-18T11:59:40Z", NOW)).toBe("agora");
    expect(relativeTime("2026-07-18T11:15:00Z", NOW)).toBe("há 45 min");
    expect(relativeTime("2026-07-18T04:00:00Z", NOW)).toBe("há 8 h");
    expect(relativeTime("2026-07-11T12:00:00Z", NOW)).toBe("há 7 d");
    expect(relativeTime("2026-02-18T12:00:00Z", NOW)).toBe("há 5 meses");
    expect(relativeTime("2024-07-18T12:00:00Z", NOW)).toBe("há 2 anos");
  });

  it("entradas inválidas viram traço", () => {
    expect(relativeTime(null, NOW)).toBe("—");
    expect(relativeTime("data-podre", NOW)).toBe("—");
  });

  it("data no futuro não explode", () => {
    expect(relativeTime("2026-07-19T12:00:00Z", NOW)).toBe("agora");
  });
});

describe("repoFromUrl", () => {
  it("extrai owner/repo", () => {
    expect(repoFromUrl("https://api.github.com/repos/Jdmatta/olimpo")).toBe(
      "Jdmatta/olimpo",
    );
  });
});
