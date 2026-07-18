import { lazy } from "react";
import type { ComponentType, LazyExoticComponent, ReactNode } from "react";
import {
  FolderOpen,
  Mountain,
  Settings,
  SquareTerminal,
  Timer,
} from "lucide-react";

/** Marca do GitHub — lucide removeu ícones de marca na v1. */
function GithubMark({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.95.1-.74.4-1.25.72-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11.04 11.04 0 0 1 5.77 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.24 2.76.12 3.05.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.05.77 2.12 0 1.53-.01 2.76-.01 3.14 0 .3.2.66.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}
import type { AppId, Size } from "../os/window-manager/types";
import ComingSoon from "./ComingSoon";
import AboutApp from "./about/AboutApp";

export interface AppMeta {
  id: AppId;
  title: string;
  icon: (size?: number) => ReactNode;
  component: ComponentType | LazyExoticComponent<ComponentType>;
  defaultSize: Size;
  minSize: Size;
  multiInstance: boolean;
  /** Aparece no dock por padrão. */
  pinned: boolean;
}

const registry: Record<AppId, AppMeta> = {
  files: {
    id: "files",
    title: "Arquivos",
    icon: (size = 26) => <FolderOpen size={size} strokeWidth={1.6} />,
    component: () => (
      <ComingSoon title="Arquivos" hint="O explorer real do workspace chega no M3." />
    ),
    defaultSize: { w: 900, h: 560 },
    minSize: { w: 560, h: 360 },
    multiInstance: false,
    pinned: true,
  },
  terminal: {
    id: "terminal",
    title: "Terminal",
    icon: (size = 26) => <SquareTerminal size={size} strokeWidth={1.6} />,
    // lazy: o xterm só entra no bundle quando o Terminal abre.
    component: lazy(() => import("./terminal/TerminalApp")),
    defaultSize: { w: 840, h: 500 },
    minSize: { w: 480, h: 300 },
    multiInstance: true,
    pinned: true,
  },
  github: {
    id: "github",
    title: "GitHub",
    icon: (size = 26) => <GithubMark size={size} />,
    component: () => (
      <ComingSoon title="GitHub" hint="Repos, issues e PRs via API oficial no M5." />
    ),
    defaultSize: { w: 960, h: 620 },
    minSize: { w: 600, h: 420 },
    multiInstance: false,
    pinned: true,
  },
  focus: {
    id: "focus",
    title: "Foco",
    icon: (size = 26) => <Timer size={size} strokeWidth={1.6} />,
    component: () => (
      <ComingSoon title="Foco" hint="Pomodoro + tarefas do dia chegam no M4." />
    ),
    defaultSize: { w: 420, h: 620 },
    minSize: { w: 360, h: 480 },
    multiInstance: false,
    pinned: true,
  },
  settings: {
    id: "settings",
    title: "Ajustes",
    icon: (size = 26) => <Settings size={size} strokeWidth={1.6} />,
    component: () => (
      <ComingSoon title="Ajustes" hint="Wallpaper, shells e conexões no M6." />
    ),
    defaultSize: { w: 720, h: 520 },
    minSize: { w: 520, h: 400 },
    multiInstance: false,
    pinned: true,
  },
  about: {
    id: "about",
    title: "Sobre o Olimpo",
    icon: (size = 26) => <Mountain size={size} strokeWidth={1.6} />,
    component: AboutApp,
    defaultSize: { w: 460, h: 340 },
    minSize: { w: 400, h: 300 },
    multiInstance: false,
    pinned: false,
  },
};

export function getAppMeta(appId: AppId): AppMeta {
  return registry[appId];
}

export function listPinnedApps(): AppMeta[] {
  return Object.values(registry).filter((a) => a.pinned);
}

export function listAllApps(): AppMeta[] {
  return Object.values(registry);
}
