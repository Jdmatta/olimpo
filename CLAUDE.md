# Olimpo

## O que é

"Sistema operacional" desktop pessoal (Tauri 2 + React TS): shell com janelas/dock/menubar glassmorphism e apps reais — Arquivos, Terminal (pty), GitHub, Foco. Consulte `SPECS.md` antes de implementar qualquer feature; plano de milestones em `~/.claude/plans/melodic-drifting-babbage.md`.

## Stack

Tauri 2 (Rust stable-msvc) · React 19 + TypeScript + Vite · zustand 5 · Tailwind 4 + glass.css · portable-pty + @xterm/xterm 6 · rusqlite (bundled) · keyring 4 · reqwest.

## Comandos

```powershell
npm run tauri dev      # app em desenvolvimento (compila Rust na primeira vez)
npm test               # vitest
cd src-tauri; cargo test   # testes Rust
cd src-tauri; cargo check  # validação rápida de compilação
npm run tauri build    # instalador NSIS
```

## Estrutura

- `src/os/` — shell: `window-manager/` (store zustand + Window.tsx + snap.ts), `dock/`, `menubar/`, `spotlight/`, `desktop/`, `theme/`.
- `src/apps/` — `registry.ts` + um diretório por app (files, terminal, github, focus, settings).
- `src/lib/ipc.ts` — ÚNICA superfície de `invoke` tipado; componente nunca chama invoke direto.
- `src-tauri/src/` — módulos por feature (`fs/`, `pty/`, `github/`, `db/`, `secrets/`), cada um com `commands.rs` registrado em `lib.rs`.
- `docs/SMOKE.md` — checklist manual por milestone.

## Regras inegociáveis

- Todo acesso a arquivo passa por `fs/path_guard.rs`. Delete SÓ via crate `trash`.
- PAT GitHub SÓ via `secrets/` (keyring/Credential Manager) — nunca em JS, db, log ou repo.
- SQL só em `db/repos.rs` com `params![]`. Processos só com arg-list (`Command`), nunca shell string.
- Terminal: output via Channel com payload raw — nunca eventos, nunca `Vec<u8>` serde.
- Janela é opaca; vidro é `backdrop-filter` in-DOM (não usar transparent/vibrancy sem decisão explícita).
- Pomodoro usa timestamps (wall-clock), nunca contagem de setInterval.

## Não mexer

- `src-tauri/capabilities/default.json` sem revisar least-privilege.
- CSP no `tauri.conf.json` — mudanças só com justificativa de segurança.
