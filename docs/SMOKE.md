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
- [x] Fechar janelas/app → sem pwsh/conhost órfão (verificado por máquina: 4→1 pwsh, 0 órfãos).
- [x] pty spawna pwsh de verdade dentro do app (árvore de processos conferida).

## M3 — Arquivos
- [ ] Criar/renomear/mover pasta e arquivo; F2; drag pra pasta.
- [ ] Del → confirmação → item aparece na Lixeira do Windows.
- [ ] "Abrir no VS Code" e "Revelar no Explorer" funcionam.
- [ ] Ataques: `..\..`, caminho absoluto fora do root, junction → rejeitados.

## M4 — Foco
- [ ] Pomodoro completo dispara toast; chip no menubar conta; auto-inicia pausa.
- [ ] Matar app no meio do pomodoro → relaunch restaura estado são (sessão vencida = completa).
- [ ] Todos e layouts de janela sobrevivem restart; "← ontem" traz não-feitos.
- [ ] Modo imersivo cobre tudo durante foco; sair/encerrar funcionam.

## M5 — GitHub
- [ ] Conectar PAT fine-grained → perfil aparece; PAT no Credential Manager (conferir UI do Windows); ausente de repo/db/localStorage/devtools.
- [ ] Revogar token no GitHub → app mostra reconectar, sem crash.
- [ ] Repos listam; clique → commits; issues/PRs abrem no navegador.
- [ ] Offline → banner amarelo, sem crash.

## M6 — Spotlight/snap/settings
- [ ] Ctrl+Space → "ter" → Enter abre Terminal.
- [ ] Snap: arrastar até borda mostra preview e encaixa (L/R/top).
- [ ] Trocar wallpaper e root do workspace pelo Settings.

## M7 — Instalador
- [ ] `npm run tauri build` gera NSIS; instalar e rodar tudo de novo por cima.
