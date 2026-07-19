# Análise — rodar apps DENTRO do Olimpo

Pedido: navegador e apps rodando dentro das janelas do shell (não janelas nativas separadas).

## Caminhos possíveis no Windows

| Abordagem | Viabilidade | Situação |
|---|---|---|
| **iframe** | ❌ | Google, YouTube, GitHub etc. mandam `X-Frame-Options: DENY` — não carregam em iframe. Só funcionaria pra docs/wikis. |
| **Child webview do Tauri** (feature `unstable`) | ⚠️ quase | Prototipado e removido (git não guardou — refazer é ~1h com este roteiro): `add_child(WebviewBuilder::new(label, WebviewUrl::External(url)))` na janela main + comandos bounds/navigate/hide, janela fake "Navegador" com barra de URL sincronizando o rect via `getBoundingClientRect`. Resultado do teste (tauri 2.11/Windows): a child é criada, **renderiza e navega quando controlada por CDP**, mas a ponte do wry (navigate/eval Rust→child) não chega nela — fica em `about:blank`. Sem controle = sem barra de URL. Reavaliar a cada release do tauri/wry. Limitação extra conhecida: webview nativa flutua sobre o DOM (janelas do shell não cobrem o browser). |
| **SetParent (Win32) em apps nativos** | ⚠️ hack | Adotar a janela de um app externo (VS Code, Brave) como filha do Olimpo via `SetParent` + `WS_CHILD`, sincronizando o rect com a janela fake. Funciona em muitos apps, mas: DPI esquisito, foco/atalhos capturados errado, apps Chromium reagem mal, risco de travar o app hospedado. É o truque de "window docking" clássico — demo impressionante, manutenção cara. Se topar o risco, é um projeto v1.4 de ~2 sessões. |
| **WebviewWindow separada** | ✅ fácil | Janela nativa própria do Olimpo com uma URL (sem barra de endereço custom). Não fica "dentro" do shell — perde a graça. |

## Recomendação

1. **Hoje**: launcher (v1.2) + F11 fullscreen cobre o fluxo real — Olimpo em tela cheia, apps externos por cima, dock traz de volta.
2. **Quando o wry corrigir a ponte da child**: religar o navegador embutido (código pronto, testes de URL inclusos).
3. **SetParent**: só se o embutido nativo virar prioridade de portfólio — é vitrine técnica, mas frágil por natureza.
