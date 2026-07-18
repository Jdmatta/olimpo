import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import "./terminal.css";
import { ptyKill, ptyResize, ptySpawn, ptyWrite, settingsGet } from "../../lib/ipc";
import type { ShellProfile } from "../../lib/ipc";
import { useWindowContext } from "../../os/window-manager/context";

function isProfile(v: string | null): v is ShellProfile {
  return v === "pwsh" || v === "powershell" || v === "cmd";
}

const PROFILES: { id: ShellProfile; label: string }[] = [
  { id: "pwsh", label: "pwsh 7" },
  { id: "powershell", label: "PowerShell" },
  { id: "cmd", label: "cmd" },
];

function makeTerminal(): Terminal {
  return new Terminal({
    allowTransparency: true,
    cursorBlink: true,
    fontFamily: '"Cascadia Mono", Consolas, monospace',
    fontSize: 13.5,
    lineHeight: 1.25,
    scrollback: 8000,
    theme: {
      // Canvas do xterm não compõe transparência de verdade; tom do vidro.
      background: "#0b1122",
      foreground: "#e4e4f0",
      cursor: "#f0d489",
      cursorAccent: "#0b1226",
      selectionBackground: "rgba(217, 180, 91, 0.28)",
      black: "#1a1d29",
      brightBlack: "#565d75",
    },
  });
}

function TerminalApp() {
  const hostRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<{ term: Terminal; ptyId: number | null } | null>(null);
  const { payload } = useWindowContext();
  // "Abrir Terminal aqui" do app Arquivos passa o cwd pela janela.
  const cwd = typeof payload?.cwd === "string" ? payload.cwd : undefined;
  const [profile, setProfile] = useState<ShellProfile | null>(null);
  // generation muda quando o usuário troca o shell: derruba e recria a sessão.
  const [generation, setGeneration] = useState(0);

  // Shell padrão vem dos Ajustes; só spawna depois de resolver.
  useEffect(() => {
    settingsGet("default_shell")
      .then((v) => setProfile(isProfile(v) ? v : "pwsh"))
      .catch(() => setProfile("pwsh"));
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || profile === null) return;

    const term = makeTerminal();
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    fit.fit();
    term.focus();

    const session = { term, ptyId: null as number | null };
    sessionRef.current = session;
    let disposed = false;

    ptySpawn(
      { profile, cols: term.cols, rows: term.rows, cwd },
      (data) => term.write(data),
      () => {
        if (!disposed) {
          term.write("\r\n\x1b[2m[sessão encerrada]\x1b[0m\r\n");
          session.ptyId = null;
        }
      },
    )
      .then((id) => {
        if (disposed) {
          ptyKill(id).catch(() => {});
        } else {
          session.ptyId = id;
        }
      })
      .catch((err) => {
        term.writeln("\x1b[31mNão consegui abrir o shell.\x1b[0m");
        term.writeln(
          "\x1b[2mRodando fora do app Tauri? O terminal só funciona no Olimpo de verdade.\x1b[0m",
        );
        term.writeln(`\x1b[2m${String(err?.message ?? err)}\x1b[0m`);
      });

    const dataSub = term.onData((chunk) => {
      if (session.ptyId != null) {
        ptyWrite(session.ptyId, chunk).catch(() => {});
      }
    });

    let resizeTimer: number | undefined;
    const observer = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (disposed) return;
        fit.fit();
        if (session.ptyId != null) {
          ptyResize(session.ptyId, term.cols, term.rows).catch(() => {});
        }
      }, 50);
    });
    observer.observe(host);

    return () => {
      disposed = true;
      window.clearTimeout(resizeTimer);
      observer.disconnect();
      dataSub.dispose();
      if (session.ptyId != null) {
        ptyKill(session.ptyId).catch(() => {});
      }
      term.dispose();
      sessionRef.current = null;
    };
    // profile entra via generation: trocar shell recria a sessão inteira.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generation, profile === null]);

  function switchProfile(next: ShellProfile) {
    if (next === profile) return;
    setProfile(next);
    setGeneration((g) => g + 1);
  }

  return (
    <div className="terminal-app">
      <div className="terminal-toolbar">
        <select
          className="terminal-profile"
          value={profile ?? "pwsh"}
          onChange={(e) => switchProfile(e.target.value as ShellProfile)}
          title="Trocar shell (recria a sessão)"
        >
          {PROFILES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <div ref={hostRef} className="terminal-host" />
    </div>
  );
}

export default TerminalApp;
