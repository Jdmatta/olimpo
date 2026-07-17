# SPECS — Olimpo

## Objetivo

"Sistema operacional" desktop pessoal estilo macOS/Win11 com glassmorfismo: um shell com janelas, dock e apps reais (arquivos, terminal, GitHub, foco) para maximizar foco e organização no trabalho dev. Peça central do portfólio do Jairo e ferramenta de uso diário.

## Quem usa

Jairo, no desktop Windows 11. Dev iniciante/intermediário (Python/React); o código Rust é escrito pelo Claude em modo /tt-pro. Uso diário real — não é protótipo.

## Requisitos funcionais

### Shell (base do OS)
- RF1 — Janela única maximizada frameless; wallpaper em camada DOM; todo vidro via `backdrop-filter` in-DOM.
- RF2 — Janelas de app arrastáveis, redimensionáveis (8 handles), com traffic lights (fechar/minimizar/maximizar), z-order por foco, minimizar para o dock.
- RF3 — Dock central estilo macOS com magnify, indicador de app aberto e animação de minimize.
- RF4 — Menubar no topo: menu Olimpo (About/Settings/Quit), chip do pomodoro, relógio.
- RF5 — Spotlight (Ctrl+Space): busca fuzzy por apps, quick links e ações (ex.: "Start pomodoro").
- RF6 — Edge-snap com preview (metades esquerda/direita, topo = maximizar).
- RF7 — Layouts de janela persistem entre sessões (SQLite).
- RF8 — Quick links (CRUD) no desktop/menubar — LinkedIn, GitHub etc. abrem no navegador padrão.

### Apps v1
- RF9 — **Arquivos**: navegar o workspace real (`Trabalhos Programacao`), criar/renomear/mover; deletar SEMPRE para a Lixeira com confirmação; abrir no VS Code; revelar no Explorer; "Abrir Terminal aqui".
- RF10 — **Terminal**: pty real (ConPTY) com xterm.js; perfis pwsh 7 (default), Windows PowerShell e cmd; múltiplas janelas de terminal; resize correto; Ctrl+C funciona.
- RF11 — **GitHub**: dashboard via API oficial — perfil, repos por push recente, issues/PRs atribuídos, commits do repo selecionado; cache 5 min + refresh manual; estado offline gracioso.
- RF12 — **Foco**: todos do dia (add/toggle/reorder/carry-over), pomodoro configurável (25/5 default) com toast nativo, focus-mode overlay (esconde dock/menubar, mostra timer + tarefa atual), histórico 14 dias.
- RF13 — **Settings**: root do workspace, perfil de shell, durações do pomodoro, wallpaper (pasta do usuário em %APPDATA%), conexão GitHub, autostart opcional.

## Requisitos não-funcionais

- **Performance**: drag/resize de janelas fluido (sem jank perceptível); terminal aguenta output em flood (`Get-ChildItem -Recurse System32`) sem travar a UI; abertura do app < 3s.
- **Segurança**: PAT do GitHub só no Windows Credential Manager (keyring), nunca em repo/db/localStorage; todo acesso FS passa por `path_guard.rs` (canonicalize + starts_with(root), nomes reservados rejeitados); delete só via Lixeira (crate trash); SQL sempre parametrizado (rusqlite, repos tipados); processos via arg-list, nunca shell string; CSP restritiva; capabilities mínimas; nenhum secret no repo.
- **Compatibilidade**: Windows 11 desktop. Sem mobile, sem web deploy (demo por vídeo/GIF no README).

## Stack escolhida e por quê

| Camada | Tecnologia | Por quê |
|---|---|---|
| Shell nativo | Tauri 2 (Rust) | Binário leve, WebView2 nativo do Win11, acesso real a FS/pty/keyring; escolha do Jairo p/ portfólio |
| Frontend | React 19 + TypeScript + Vite | Stack do mercado; TS pega erros cedo em projeto grande |
| Estado UI | zustand 5 | Store minimalista p/ window manager, fácil de testar |
| Estilo | Tailwind 4 + glass.css próprio | Velocidade + tokens de glassmorfismo custom |
| Terminal | portable-pty 0.9 + @xterm/xterm 6 | ConPTY puro Rust (zero build nativo Node); xterm é o padrão (VS Code) |
| Banco | rusqlite 0.40 (bundled) | Camada tipada em Rust testável; plugin SQL exporia SQL cru ao webview |
| GitHub | reqwest + DTOs serde | PAT fica no lado Rust; octocrab = dep-tree grande e API 0.x instável |
| Segredos | keyring 4 (Credential Manager) | Padrão do SO, PAT nunca em texto plano |

## Critérios de aceite — "pronto quando..."

- [ ] Instalador NSIS instala e o app abre maximizado frameless com wallpaper + vidro.
- [ ] 3+ janelas: drag, resize, snap, minimize pro dock, foco/z-order — tudo fluido e persistido.
- [ ] Arquivos: criar pasta, renomear, mover, deletar (aparece na Lixeira), abrir no VS Code.
- [ ] Ataques de path (`..\..`, absoluto fora do root, junction) rejeitados — testes table-driven verdes.
- [ ] Terminal: comando com output gigante sem freeze; Ctrl+C; sem conhost órfão após fechar.
- [ ] Pomodoro completo com toast; matar o app no meio → relaunch restaura são; todos sobrevivem restart.
- [ ] GitHub conectado: PAT visível no Credential Manager e ausente do repo/db/devtools; token revogado → prompt de reconexão.
- [ ] Ctrl+Space → "ter" → Enter abre o Terminal.
- [ ] `cargo test` + `npm test` verdes; /tt-sec-check final aprovado.

## Fora de escopo (por enquanto)

- FS watching automático (`notify`) — v1.1; refresh pós-operação/on-focus/F5 no v1.
- Abas no terminal (múltiplas janelas resolvem no v1).
- Restaurar da Lixeira, multi-monitor, temas claros, mobile, deploy web.
- Assinatura de código (custo) — README documenta o aviso SmartScreen.
- Acrílico nativo (`window-vibrancy`) — experimento opcional pós-v1, default off.
