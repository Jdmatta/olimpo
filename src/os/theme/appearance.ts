/** Personalização visual: acento, densidade do vidro, animações. */

export interface AccentPreset {
  id: string;
  label: string;
  base: string;
  bright: string;
}

export const ACCENTS: AccentPreset[] = [
  { id: "louro", label: "Louro", base: "#d9b45b", bright: "#f0d489" },
  { id: "prata", label: "Prata", base: "#b8c4d8", bright: "#e6ecf6" },
  { id: "esmeralda", label: "Esmeralda", base: "#4ecca3", bright: "#8ee8c9" },
  { id: "ambar", label: "Âmbar", base: "#e8944c", bright: "#f4c088" },
  { id: "rubi", label: "Rubi", base: "#e05a6d", bright: "#f09aa6" },
];

export interface GlassLevel {
  id: string;
  label: string;
  blur: string;
  bg: string;
  bgStrong: string;
}

export const GLASS_LEVELS: GlassLevel[] = [
  {
    id: "leve",
    label: "Leve",
    blur: "14px",
    bg: "rgba(16, 22, 44, 0.38)",
    bgStrong: "rgba(12, 17, 34, 0.55)",
  },
  {
    id: "padrao",
    label: "Padrão",
    blur: "28px",
    bg: "rgba(16, 22, 44, 0.55)",
    bgStrong: "rgba(12, 17, 34, 0.72)",
  },
  {
    id: "denso",
    label: "Denso",
    blur: "42px",
    bg: "rgba(16, 22, 44, 0.7)",
    bgStrong: "rgba(12, 17, 34, 0.85)",
  },
];

export interface AppearanceTokens {
  accent: AccentPreset;
  glass: GlassLevel;
  reducedMotion: boolean;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Resolve settings cruas em tokens (puro — testável). Inválido cai no default. */
export function resolveAppearance(
  accentId: string | null,
  glassId: string | null,
  reduced: string | null,
): AppearanceTokens {
  return {
    accent: ACCENTS.find((a) => a.id === accentId) ?? ACCENTS[0],
    glass: GLASS_LEVELS.find((g) => g.id === glassId) ?? GLASS_LEVELS[1],
    reducedMotion: reduced === "1",
  };
}

/** Aplica os tokens nas CSS vars do documento. */
export function applyAppearance(tokens: AppearanceTokens): void {
  const root = document.documentElement;
  root.style.setProperty("--laurel", tokens.accent.base);
  root.style.setProperty("--laurel-bright", tokens.accent.bright);
  root.style.setProperty(
    "--glass-border-focus",
    hexToRgba(tokens.accent.bright, 0.35),
  );
  root.style.setProperty("--glass-blur", tokens.glass.blur);
  root.style.setProperty("--glass-bg", tokens.glass.bg);
  root.style.setProperty("--glass-bg-strong", tokens.glass.bgStrong);
  if (tokens.reducedMotion) {
    root.setAttribute("data-reduced-motion", "1");
  } else {
    root.removeAttribute("data-reduced-motion");
  }
}
