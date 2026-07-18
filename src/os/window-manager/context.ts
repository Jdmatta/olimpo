import { createContext, useContext } from "react";
import type { WindowPayload } from "./types";

export interface WindowContextValue {
  windowId: string;
  isFocused: boolean;
  payload?: WindowPayload;
}

export const WindowContext = createContext<WindowContextValue | null>(null);

/** Contexto da janela dona do app (id, foco, payload de abertura). */
export function useWindowContext(): WindowContextValue {
  const ctx = useContext(WindowContext);
  if (!ctx) {
    throw new Error("useWindowContext precisa estar dentro de uma janela");
  }
  return ctx;
}
