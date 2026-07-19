import { useEffect, useState } from "react";
import { listPinnedApps } from "../../apps/registry";
import { extappLaunch, extappList } from "../../lib/ipc";
import type { ExternalApp } from "../../lib/ipc";
import { extAppIcon } from "../dock/Dock";
import { useWindowStore } from "../window-manager/store";
import "./desktopicons.css";

interface IconEntry {
  key: string;
  label: string;
  icon: React.ReactNode;
  open: () => void;
}

/** Ícones da área de trabalho — duplo clique abre (padrão de desktop). */
function DesktopIcons() {
  const openWindow = useWindowStore((s) => s.open);
  const [extapps, setExtapps] = useState<ExternalApp[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      extappList()
        .then(setExtapps)
        .catch(() => {});
    load();
    window.addEventListener("olimpo:extapps-changed", load);
    return () => window.removeEventListener("olimpo:extapps-changed", load);
  }, []);

  const entries: IconEntry[] = [
    ...listPinnedApps().map((app) => ({
      key: `app:${app.id}`,
      label: app.title,
      icon: app.icon(30),
      open: () => openWindow(app.id),
    })),
    ...extapps.map((app) => ({
      key: `ext:${app.id}`,
      label: app.label,
      icon: extAppIcon(app.icon, 30),
      open: () => void extappLaunch(app.id).catch(() => {}),
    })),
  ];

  return (
    <div className="desktop-icons" onClick={() => setSelected(null)}>
      {entries.map((entry) => (
        <button
          key={entry.key}
          className={`desktop-icon ${selected === entry.key ? "desktop-icon--selected" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            setSelected(entry.key);
          }}
          onDoubleClick={() => {
            setSelected(null);
            entry.open();
          }}
        >
          <span className="desktop-icon__glyph glass-soft">{entry.icon}</span>
          <span className="desktop-icon__label">{entry.label}</span>
        </button>
      ))}
    </div>
  );
}

export default DesktopIcons;
