/**
 * ÚNICA superfície de IPC do frontend — todo `invoke` tipado vive aqui.
 * Componentes nunca chamam invoke direto (regra do CLAUDE.md do projeto).
 */
import { Channel, invoke } from "@tauri-apps/api/core";

export type ShellProfile = "pwsh" | "powershell" | "cmd";

interface PtyExitMessage {
  type: "exit";
}

export interface PtySpawnOptions {
  profile: ShellProfile;
  cols: number;
  rows: number;
  cwd?: string;
}

export async function ptySpawn(
  opts: PtySpawnOptions,
  onData: (data: Uint8Array) => void,
  onExit: () => void,
): Promise<number> {
  const channel = new Channel<ArrayBuffer | Uint8Array | PtyExitMessage>();
  channel.onmessage = (message) => {
    if (message instanceof ArrayBuffer) {
      onData(new Uint8Array(message));
    } else if (message instanceof Uint8Array) {
      onData(message);
    } else if (message.type === "exit") {
      onExit();
    }
  };
  return invoke<number>("pty_spawn", { ...opts, onData: channel });
}

export function ptyWrite(id: number, data: string): Promise<void> {
  return invoke("pty_write", { id, data });
}

export function ptyResize(id: number, cols: number, rows: number): Promise<void> {
  return invoke("pty_resize", { id, cols, rows });
}

export function ptyKill(id: number): Promise<void> {
  return invoke("pty_kill", { id });
}

// ---------- Arquivos ----------

export interface FsEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified_ms: number;
}

export interface FsListing {
  path: string;
  entries: FsEntry[];
}

export function fsList(path?: string): Promise<FsListing> {
  return invoke("fs_list", { path: path ?? null });
}

export function fsCreateDir(parent: string, name: string): Promise<FsEntry> {
  return invoke("fs_create_dir", { parent, name });
}

export function fsCreateFile(parent: string, name: string): Promise<FsEntry> {
  return invoke("fs_create_file", { parent, name });
}

export function fsRename(path: string, newName: string): Promise<FsEntry> {
  return invoke("fs_rename", { path, newName });
}

export function fsMove(path: string, targetDir: string): Promise<FsEntry> {
  return invoke("fs_move", { path, targetDir });
}

/** Vai para a Lixeira — nunca deleta permanente (regra do projeto). */
export function fsDelete(path: string): Promise<void> {
  return invoke("fs_delete", { path });
}

export function fsOpenInVsCode(path: string): Promise<void> {
  return invoke("fs_open_in_vscode", { path });
}

export function fsRevealInExplorer(path: string): Promise<void> {
  return invoke("fs_reveal_in_explorer", { path });
}
