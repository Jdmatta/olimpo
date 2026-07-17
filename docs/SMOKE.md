# SMOKE — checklist manual por milestone

Rodar após cada milestone, antes do commit final dele.

## M0 — Scaffold
- [x] `npm test` verde (vitest).
- [x] `cargo check` verde em `src-tauri`.
- [x] `npm run tauri dev` abre janela maximizada frameless com "OLIMPO".

## M1 — Shell core
- [ ] 3 janelas abertas, arrastar/redimensionar fluido, foco traz pra frente.
- [ ] Minimizar anima pro dock; reabrir pelo dock restaura.
- [ ] Vidro legível sobre wallpaper (blur + borda + sombra).

## M2 — Terminal
- [ ] `Get-ChildItem -Recurse C:\Windows\System32` flui sem travar UI.
- [ ] Ctrl+C interrompe; `git log` pagina; resize reflui.
- [ ] Fechar janelas/app → sem conhost/OpenConsole órfão no Task Manager.

## M3 — Arquivos
- [ ] Criar/renomear/mover pasta e arquivo; F2; drag pra pasta.
- [ ] Del → confirmação → item aparece na Lixeira do Windows.
- [ ] "Abrir no VS Code" e "Revelar no Explorer" funcionam.
- [ ] Ataques: `..\..`, caminho absoluto fora do root, junction → rejeitados.

## M4 — Foco
- [ ] Pomodoro completo dispara toast; chip no menubar conta.
- [ ] Matar app no meio do pomodoro → relaunch restaura estado são.
- [ ] Todos e layouts de janela sobrevivem restart.

## M5 — GitHub
- [ ] PAT no Credential Manager (conferir UI do Windows); ausente de repo/db/localStorage/devtools.
- [ ] Revogar token no GitHub → app mostra reconectar, sem crash.
- [ ] Offline → banner + dados em cache.

## M6 — Spotlight/snap/settings
- [ ] Ctrl+Space → "ter" → Enter abre Terminal.
- [ ] Snap: arrastar até borda mostra preview e encaixa (L/R/top).
- [ ] Trocar wallpaper e root do workspace pelo Settings.

## M7 — Instalador
- [ ] `npm run tauri build` gera NSIS; instalar e rodar tudo de novo por cima.
