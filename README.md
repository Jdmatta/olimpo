# Olimpo

Um "sistema operacional" desktop pessoal — shell estilo macOS/Win11 com glassmorfismo, janelas, dock e apps reais para foco e organização no trabalho dev.

> Em construção. Screenshots, GIF e arquitetura entram na v1.0.

## Apps (v1)

- **Arquivos** — explorer real do workspace (deletes vão pra Lixeira, sempre)
- **Terminal** — ConPTY real (pwsh/PowerShell/cmd) com xterm.js
- **GitHub** — dashboard via API oficial (PAT guardado no Windows Credential Manager)
- **Foco** — pomodoro + tarefas do dia + focus mode
- Shell: janelas arrastáveis, dock com magnify, menubar, Spotlight (Ctrl+Space), snap

## Stack

Tauri 2 (Rust) · React 19 + TypeScript · zustand · Tailwind 4 · portable-pty + xterm · rusqlite · keyring

## Rodar

```powershell
npm install
npm run tauri dev
```

Pré-requisitos: Node 20+, Rust stable-msvc, VS Build Tools (C++), WebView2 (nativo no Win11).
