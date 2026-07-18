import { useEffect, useState } from "react";
import { FolderOpen, Plus, Trash2 } from "lucide-react";
import {
  githubDisconnect,
  githubStatus,
  quicklinkAdd,
  quicklinkDelete,
  quicklinkList,
  settingsGet,
  settingsSet,
  wallpaperList,
} from "../../lib/ipc";
import type { QuickLinkDto, WallpaperInfo } from "../../lib/ipc";
import type { ShellProfile } from "../../lib/ipc";
import "./settings.css";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="set-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function WallpaperSection() {
  const [info, setInfo] = useState<WallpaperInfo | null>(null);
  const [current, setCurrent] = useState<string>("");

  useEffect(() => {
    wallpaperList()
      .then(setInfo)
      .catch(() => {});
    settingsGet("wallpaper_file")
      .then((v) => setCurrent(v ?? ""))
      .catch(() => {});
  }, []);

  function apply(file: string) {
    setCurrent(file);
    settingsSet("wallpaper_file", file).catch(() => {});
    window.dispatchEvent(new Event("olimpo:wallpaper-changed"));
  }

  return (
    <Section title="Wallpaper">
      <div className="set-wallpapers">
        <button
          className={`set-wall ${current === "" ? "set-wall--on" : ""}`}
          onClick={() => apply("")}
        >
          <span className="set-wall__proc" />
          Olimpo (padrão)
        </button>
        {info?.files.map((file) => (
          <button
            key={file}
            className={`set-wall ${current === file ? "set-wall--on" : ""}`}
            onClick={() => apply(file)}
            title={file}
          >
            <span className="set-wall__file">{file}</span>
          </button>
        ))}
      </div>
      <p className="set-note">
        Jogue .jpg/.png em{" "}
        <button
          className="set-link"
          onClick={() => {
            // Pasta fica fora do workspace: abre direto pelo Explorer.
            void import("@tauri-apps/plugin-opener")
              .then((m) => m.revealItemInDir(info!.dir))
              .catch(() => {});
          }}
          disabled={!info}
        >
          {info?.dir ?? "…"}
        </button>{" "}
        e eles aparecem aqui.
      </p>
    </Section>
  );
}

function TerminalSection() {
  const [shell, setShell] = useState<ShellProfile>("pwsh");

  useEffect(() => {
    settingsGet("default_shell")
      .then((v) => {
        if (v === "pwsh" || v === "powershell" || v === "cmd") setShell(v);
      })
      .catch(() => {});
  }, []);

  function apply(next: ShellProfile) {
    setShell(next);
    settingsSet("default_shell", next).catch(() => {});
  }

  return (
    <Section title="Terminal">
      <div className="set-row">
        <span>Shell padrão de novas janelas</span>
        <select
          value={shell}
          onChange={(e) => apply(e.target.value as ShellProfile)}
        >
          <option value="pwsh">pwsh 7</option>
          <option value="powershell">Windows PowerShell</option>
          <option value="cmd">cmd</option>
        </select>
      </div>
    </Section>
  );
}

function GithubSection() {
  const [status, setStatus] = useState<{ connected: boolean; login: string | null } | null>(
    null,
  );

  const reload = () =>
    githubStatus()
      .then(setStatus)
      .catch(() => setStatus(null));

  useEffect(() => {
    void reload();
  }, []);

  return (
    <Section title="GitHub">
      {status?.connected ? (
        <div className="set-row">
          <span>
            Conectado{status.login ? ` como @${status.login}` : ""} — token no
            Cofre de Credenciais do Windows.
          </span>
          <button
            className="set-btn set-btn--danger"
            onClick={() => void githubDisconnect().then(reload)}
          >
            Desconectar
          </button>
        </div>
      ) : (
        <p className="set-note">
          Não conectado. Abra o app <strong>GitHub</strong> no dock para
          conectar com um fine-grained token (somente leitura).
        </p>
      )}
    </Section>
  );
}

function QuickLinksSection() {
  const [links, setLinks] = useState<QuickLinkDto[]>([]);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reload = () =>
    quicklinkList()
      .then(setLinks)
      .catch(() => {});

  useEffect(() => {
    void reload();
  }, []);

  function notifyChanged() {
    window.dispatchEvent(new Event("olimpo:quicklinks-changed"));
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await quicklinkAdd(label.trim(), url.trim());
      setLabel("");
      setUrl("");
      await reload();
      notifyChanged();
    } catch (err) {
      setError(String((err as { message?: string })?.message ?? err));
    }
  }

  return (
    <Section title="Quick links">
      <form className="set-linkform" onSubmit={(e) => void add(e)}>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Nome (ex.: LinkedIn)"
          maxLength={100}
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          maxLength={2000}
        />
        <button
          className="set-btn"
          type="submit"
          disabled={!label.trim() || !url.trim()}
        >
          <Plus size={14} />
        </button>
      </form>
      {error && <div className="set-error">{error}</div>}
      <ul className="set-links">
        {links.map((l) => (
          <li key={l.id}>
            <span className="set-links__label">{l.label}</span>
            <span className="set-links__url">{l.url}</span>
            <button
              title="Remover"
              onClick={() =>
                void quicklinkDelete(l.id).then(reload).then(notifyChanged)
              }
            >
              <Trash2 size={13} />
            </button>
          </li>
        ))}
        {links.length === 0 && (
          <li className="set-note">Nenhum ainda — LinkedIn é um bom primeiro.</li>
        )}
      </ul>
    </Section>
  );
}

function SettingsApp() {
  return (
    <div className="set-app">
      <WallpaperSection />
      <TerminalSection />
      <GithubSection />
      <QuickLinksSection />
      <Section title="Workspace">
        <p className="set-note">
          <FolderOpen size={13} className="set-inline-icon" /> Raiz atual:{" "}
          <code>Documents\Trabalhos Programacao</code> — troca de raiz chega na
          v1.1.
        </p>
      </Section>
      <Section title="Sobre">
        <p className="set-note">Olimpo v0.1.0 · Tauri 2 + React · Jairo da Matta</p>
      </Section>
    </div>
  );
}

export default SettingsApp;
