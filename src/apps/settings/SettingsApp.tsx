import { useEffect, useState } from "react";
import { FolderOpen, Plus, Trash2 } from "lucide-react";
import {
  extappAdd,
  extappDelete,
  extappDetect,
  extappList,
  githubDisconnect,
  githubStatus,
  quicklinkAdd,
  quicklinkDelete,
  quicklinkList,
  settingsGet,
  settingsSet,
  wallpaperImport,
  wallpaperList,
} from "../../lib/ipc";
import type { ExternalApp, QuickLinkDto, WallpaperInfo } from "../../lib/ipc";
import { extAppIcon } from "../../os/dock/Dock";
import type { ShellProfile } from "../../lib/ipc";
import { WALLPAPER_PRESETS } from "../../os/desktop/Wallpaper";
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
  const [currentFile, setCurrentFile] = useState<string>("");
  const [preset, setPreset] = useState<string>("amanhecer");
  const [error, setError] = useState<string | null>(null);

  const reloadFiles = () =>
    wallpaperList()
      .then(setInfo)
      .catch(() => {});

  useEffect(() => {
    void reloadFiles();
    settingsGet("wallpaper_file")
      .then((v) => setCurrentFile(v ?? ""))
      .catch(() => {});
    settingsGet("wallpaper_preset")
      .then((v) => setPreset(v || "amanhecer"))
      .catch(() => {});
  }, []);

  function notifyChanged() {
    window.dispatchEvent(new Event("olimpo:wallpaper-changed"));
  }

  function applyPreset(id: string) {
    setPreset(id);
    setCurrentFile("");
    settingsSet("wallpaper_preset", id).catch(() => {});
    settingsSet("wallpaper_file", "").catch(() => {});
    notifyChanged();
  }

  function applyFile(file: string) {
    setCurrentFile(file);
    settingsSet("wallpaper_file", file).catch(() => {});
    notifyChanged();
  }

  async function importImage() {
    setError(null);
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const picked = await open({
        multiple: false,
        directory: false,
        filters: [{ name: "Imagens", extensions: ["jpg", "jpeg", "png", "webp"] }],
      });
      if (typeof picked !== "string") return;
      const name = await wallpaperImport(picked);
      await reloadFiles();
      applyFile(name);
    } catch (err) {
      setError(String((err as { message?: string })?.message ?? err));
    }
  }

  return (
    <Section title="Wallpaper">
      <div className="set-wallpapers">
        {WALLPAPER_PRESETS.map((p) => (
          <button
            key={p.id}
            className={`set-wall ${currentFile === "" && preset === p.id ? "set-wall--on" : ""}`}
            onClick={() => applyPreset(p.id)}
          >
            <span className={`set-wall__proc set-wall__proc--${p.id}`} />
            {p.label}
          </button>
        ))}
        {info?.files.map((file) => (
          <button
            key={file}
            className={`set-wall ${currentFile === file ? "set-wall--on" : ""}`}
            onClick={() => applyFile(file)}
            title={file}
          >
            <span className="set-wall__file">{file}</span>
          </button>
        ))}
        <button className="set-wall set-wall--add" onClick={() => void importImage()}>
          <span className="set-wall__proc set-wall__proc--add">
            <Plus size={18} />
          </span>
          Adicionar imagem…
        </button>
      </div>
      {error && <div className="set-error">{error}</div>}
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

function ExternalAppsSection() {
  const [apps, setApps] = useState<ExternalApp[]>([]);
  const [label, setLabel] = useState("");
  const [command, setCommand] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);

  const reload = () =>
    extappList()
      .then(setApps)
      .catch(() => {});

  useEffect(() => {
    void reload();
  }, []);

  function notifyChanged() {
    window.dispatchEvent(new Event("olimpo:extapps-changed"));
  }

  async function pickExe() {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const picked = await open({
        multiple: false,
        directory: false,
        filters: [{ name: "Programas", extensions: ["exe", "cmd", "bat"] }],
      });
      if (typeof picked === "string") {
        setCommand(picked);
        if (!label.trim()) {
          const base = picked.split("\\").pop() ?? "";
          setLabel(base.replace(/\.(exe|cmd|bat)$/i, ""));
        }
      }
    } catch {
      // fora do Tauri
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const lower = label.toLowerCase();
      const icon =
        /brave|chrome|edge|firefox|opera|navegador|browser/.test(lower)
          ? "globe"
          : /code|zed|cursor|studio|idea|editor/.test(lower)
            ? "code"
            : "app";
      await extappAdd(label.trim(), command.trim(), "", icon);
      setLabel("");
      setCommand("");
      await reload();
      notifyChanged();
    } catch (err) {
      setError(String((err as { message?: string })?.message ?? err));
    }
  }

  async function detect() {
    setDetecting(true);
    try {
      setApps(await extappDetect());
      notifyChanged();
    } catch (err) {
      setError(String((err as { message?: string })?.message ?? err));
    } finally {
      setDetecting(false);
    }
  }

  return (
    <Section title="Programas">
      <p className="set-note">
        Navegadores e editores aparecem no dock e no Spotlight — abrem fora do
        Olimpo (janela própria do programa).
      </p>
      <form className="set-linkform" onSubmit={(e) => void add(e)}>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Nome (ex.: Brave)"
          maxLength={60}
        />
        <input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="C:\...\programa.exe"
          maxLength={500}
        />
        <button
          type="button"
          className="set-btn"
          title="Escolher executável"
          onClick={() => void pickExe()}
        >
          …
        </button>
        <button
          className="set-btn"
          type="submit"
          disabled={!label.trim() || !command.trim()}
        >
          <Plus size={14} />
        </button>
      </form>
      {error && <div className="set-error">{error}</div>}
      <ul className="set-links">
        {apps.map((app) => (
          <li key={app.id}>
            <span className="set-extapp-icon">{extAppIcon(app.icon, 14)}</span>
            <span className="set-links__label">{app.label}</span>
            <span className="set-links__url">{app.command}</span>
            <button
              title="Remover"
              onClick={() =>
                void extappDelete(app.id).then(reload).then(notifyChanged)
              }
            >
              <Trash2 size={13} />
            </button>
          </li>
        ))}
        {apps.length === 0 && (
          <li className="set-note">
            Nenhum programa. "Redetectar" procura Brave, Chrome, Edge, Firefox,
            VS Code, Cursor e Zed.
          </li>
        )}
      </ul>
      <button className="set-btn" onClick={() => void detect()} disabled={detecting}>
        {detecting ? "Procurando…" : "Redetectar instalados"}
      </button>
    </Section>
  );
}

function AutostartSection() {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    void import("@tauri-apps/plugin-autostart")
      .then((m) => m.isEnabled())
      .then(setEnabled)
      .catch(() => setEnabled(null));
  }, []);

  async function toggle() {
    try {
      const m = await import("@tauri-apps/plugin-autostart");
      if (enabled) {
        await m.disable();
        setEnabled(false);
      } else {
        await m.enable();
        setEnabled(true);
      }
    } catch {
      // fora do Tauri
    }
  }

  return (
    <Section title="Inicialização">
      <div className="set-row">
        <span>Abrir o Olimpo junto com o Windows</span>
        <button
          role="switch"
          aria-checked={enabled === true}
          className={`set-switch ${enabled ? "set-switch--on" : ""}`}
          onClick={() => void toggle()}
          disabled={enabled === null}
        >
          <span className="set-switch__knob" />
        </button>
      </div>
    </Section>
  );
}

function SettingsApp() {
  return (
    <div className="set-app">
      <WallpaperSection />
      <ExternalAppsSection />
      <TerminalSection />
      <AutostartSection />
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
