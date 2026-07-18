import { useEffect, useState } from "react";
import { Link as LinkIcon } from "lucide-react";
import { quicklinkList } from "../../lib/ipc";
import type { QuickLinkDto } from "../../lib/ipc";
import "./quicklinks.css";

function openExternal(url: string) {
  void import("@tauri-apps/plugin-opener")
    .then((m) => m.openUrl(url))
    .catch(() => {});
}

/** Coluna de atalhos no canto do desktop (CRUD nos Ajustes). */
function QuickLinks() {
  const [links, setLinks] = useState<QuickLinkDto[]>([]);

  useEffect(() => {
    const load = () =>
      quicklinkList()
        .then(setLinks)
        .catch(() => {});
    load();
    window.addEventListener("olimpo:quicklinks-changed", load);
    return () => window.removeEventListener("olimpo:quicklinks-changed", load);
  }, []);

  if (links.length === 0) return null;

  return (
    <aside className="quicklinks">
      {links.map((link) => (
        <button
          key={link.id}
          className="quicklinks__item glass-soft"
          title={link.url}
          onClick={() => openExternal(link.url)}
        >
          <LinkIcon size={14} />
          <span>{link.label}</span>
        </button>
      ))}
    </aside>
  );
}

export default QuickLinks;
