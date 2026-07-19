import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CornerDownLeft,
  Link as LinkIcon,
  NotebookPen,
  Play,
  Search,
  Square,
} from "lucide-react";
import { listAllApps } from "../../apps/registry";
import { extappLaunch, extappList, quicklinkList } from "../../lib/ipc";
import type { ExternalApp, QuickLinkDto } from "../../lib/ipc";
import { extAppIcon } from "../dock/Dock";
import { useFocusStore } from "../focus/focusStore";
import { useWindowStore } from "../window-manager/store";
import { rankItems } from "./fuzzy";
import "./spotlight.css";

interface Item {
  key: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  run: () => void;
}

function openExternal(url: string) {
  void import("@tauri-apps/plugin-opener")
    .then((m) => m.openUrl(url))
    .catch(() => {});
}

function Spotlight() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [links, setLinks] = useState<QuickLinkDto[]>([]);
  const [extapps, setExtapps] = useState<ExternalApp[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const openWindow = useWindowStore((s) => s.open);
  const focusSession = useFocusStore((s) => s.session);

  // Ctrl+Space abre/fecha de qualquer lugar do shell.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.code === "Space") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      quicklinkList()
        .then(setLinks)
        .catch(() => setLinks([]));
      extappList()
        .then(setExtapps)
        .catch(() => setExtapps([]));
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  const items = useMemo<Item[]>(() => {
    const focus = useFocusStore.getState();
    const apps: Item[] = listAllApps().map((app) => ({
      key: `app:${app.id}`,
      label: app.title,
      hint: "abrir app",
      icon: app.icon(17),
      run: () => openWindow(app.id),
    }));
    const actions: Item[] = [
      {
        key: "act:sticky",
        label: "Nova nota (post-it)",
        hint: "estudo",
        icon: <NotebookPen size={15} />,
        run: () => void import("../desktop/createSticky").then((m) => m.createSticky()),
      },
      focusSession
        ? {
            key: "act:stop",
            label: "Encerrar sessão de foco",
            hint: "pomodoro",
            icon: <Square size={15} />,
            run: () => void focus.cancel(),
          }
        : {
            key: "act:focus",
            label: "Iniciar foco",
            hint: "pomodoro",
            icon: <Play size={15} />,
            run: () => void focus.start("focus"),
          },
    ];
    const linkItems: Item[] = links.map((l) => ({
      key: `link:${l.id}`,
      label: l.label,
      hint: "link",
      icon: <LinkIcon size={15} />,
      run: () => openExternal(l.url),
    }));
    const extItems: Item[] = extapps.map((a) => ({
      key: `ext:${a.id}`,
      label: a.label,
      hint: "abrir programa",
      icon: extAppIcon(a.icon, 15),
      run: () => void extappLaunch(a.id).catch(() => {}),
    }));
    return [...apps, ...extItems, ...actions, ...linkItems];
  }, [links, extapps, focusSession, openWindow]);

  const results = useMemo(
    () => rankItems(query, items, (i) => i.label),
    [query, items],
  );

  useEffect(() => {
    setCursor(0);
  }, [query]);

  if (!open) return null;

  function runItem(item: Item) {
    close();
    item.run();
  }

  return (
    <div className="spotlight-backdrop" onPointerDown={close}>
      <div
        className="spotlight glass-strong glass-sheen"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="spotlight__row">
          <Search size={16} className="spotlight__glyph" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(c + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(c - 1, 0));
              } else if (e.key === "Enter" && results[cursor]) {
                e.preventDefault();
                runItem(results[cursor].item);
              }
            }}
            placeholder="Buscar apps, ações e links…"
            spellCheck={false}
          />
          <kbd className="spotlight__kbd">esc</kbd>
        </div>

        {query && results.length === 0 && (
          <div className="spotlight__empty">Nada com “{query}”.</div>
        )}

        {results.length > 0 && (
          <ul className="spotlight__list">
            {results.map((r, i) => (
              <li key={r.item.key}>
                <button
                  className={`spotlight__item ${i === cursor ? "spotlight__item--active" : ""}`}
                  onPointerEnter={() => setCursor(i)}
                  onClick={() => runItem(r.item)}
                >
                  <span className="spotlight__icon">{r.item.icon}</span>
                  <span className="spotlight__label">{r.item.label}</span>
                  <span className="spotlight__hint">{r.item.hint}</span>
                  {i === cursor && <CornerDownLeft size={13} className="spotlight__enter" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default Spotlight;
