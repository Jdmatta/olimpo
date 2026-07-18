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
