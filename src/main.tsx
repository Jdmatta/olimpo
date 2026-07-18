import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { useWindowStore } from "./os/window-manager/store";

// DEV: expõe store e erros pro debug via CDP (removido em build de produção).
if (import.meta.env.DEV) {
  interface DevGlobals {
    __wm: typeof useWindowStore;
    __errs: string[];
  }
  const g = window as unknown as DevGlobals;
  g.__wm = useWindowStore;
  g.__errs = [];
  window.addEventListener("error", (e) => g.__errs.push(`error: ${e.message}`));
  window.addEventListener("unhandledrejection", (e) =>
    g.__errs.push(`rejection: ${String(e.reason)}`),
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
