export type AppId =
  | "files"
  | "terminal"
  | "notes"
  | "github"
  | "focus"
  | "settings"
  | "about";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Parâmetros de abertura passados ao app (ex.: cwd do terminal). */
export type WindowPayload = Record<string, unknown>;

export interface WindowState {
  id: string;
  appId: AppId;
  rect: Rect;
  z: number;
  minimized: boolean;
  maximized: boolean;
  /** Rect antes de maximizar, para restaurar. */
  prevRect: Rect | null;
  payload?: WindowPayload;
}

export interface Size {
  w: number;
  h: number;
}
