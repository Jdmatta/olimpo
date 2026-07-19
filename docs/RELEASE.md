# Publicar uma release (com auto-update)

O Olimpo se atualiza sozinho via `tauri-plugin-updater`, lendo `latest.json` da última Release do GitHub. Cada release precisa dos artefatos assinados.

## Pré-requisitos (uma vez)

- Chave de assinatura em `%USERPROFILE%\.tauri\olimpo.key` (privada — **nunca** no repo) e `.key.pub`.
- A chave pública já está em `src-tauri/tauri.conf.json` (`plugins.updater.pubkey`).
- Se perder a chave privada, o updater para de funcionar até gerar outra e lançar uma versão com a nova pubkey.

## Passos

1. Bump da versão em `package.json`, `src-tauri/tauri.conf.json` e `src-tauri/Cargo.toml`.
2. Build assinado (PowerShell):
   ```powershell
   $env:TAURI_SIGNING_PRIVATE_KEY = Get-Content "$env:USERPROFILE\.tauri\olimpo.key" -Raw
   $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""
   npm run tauri build
   ```
   Gera em `src-tauri/target/release/bundle/nsis/`:
   - `Olimpo_X.Y.Z_x64-setup.exe` — instalador
   - `Olimpo_X.Y.Z_x64-setup.exe.sig` — assinatura (só com `createUpdaterArtifacts: true`)
3. Montar `latest.json` (o `signature` é o conteúdo do `.sig`):
   ```json
   {
     "version": "X.Y.Z",
     "notes": "novidades",
     "pub_date": "2026-07-19T00:00:00Z",
     "platforms": {
       "windows-x86_64": {
         "signature": "<conteúdo do .exe.sig>",
         "url": "https://github.com/Jdmatta/olimpo/releases/download/vX.Y.Z/Olimpo_X.Y.Z_x64-setup.exe"
       }
     }
   }
   ```
4. Criar a Release e anexar **os dois arquivos + latest.json**:
   ```powershell
   gh release create vX.Y.Z `
     "src-tauri/target/release/bundle/nsis/Olimpo_X.Y.Z_x64-setup.exe" `
     "src-tauri/target/release/bundle/nsis/Olimpo_X.Y.Z_x64-setup.exe.sig" `
     "latest.json" `
     --title "Olimpo vX.Y.Z" --notes "..."
   ```

Instalações existentes veem a atualização no próximo boot (ou em "Buscar atualizações…").
