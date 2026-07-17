export type AppId =
  | "files"
  | "terminal"
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

export interface WindowState {
  id: string;
  appId: AppId;
  rect: Rect;
  z: number;
  minimized: boolean;
  maximized: boolean;
  /** Rect antes de maximizar, para restaurar. */
  prevRect: Rect | null;
}

export interface Size {
  w: number;
  h: number;
}
