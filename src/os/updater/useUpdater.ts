import { useCallback, useEffect, useState } from "react";

export type UpdateState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available"; version: string; notes: string }
  | { status: "downloading"; version: string }
  | { status: "ready" }
  | { status: "uptodate" }
  | { status: "error"; message: string };

interface TauriUpdate {
  version: string;
  body?: string;
  downloadAndInstall: (
    onEvent?: (e: { event: string }) => void,
  ) => Promise<void>;
}

/**
 * Updater via Release do GitHub. Check silencioso no boot; download/instala
 * só quando o usuário confirma. Fail-silent fora do Tauri.
 */
export function useUpdater() {
  const [state, setState] = useState<UpdateState>({ status: "idle" });
  const [pending, setPending] = useState<TauriUpdate | null>(null);

  const check = useCallback(async (silent: boolean) => {
    if (!silent) setState({ status: "checking" });
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = (await check()) as TauriUpdate | null;
      if (update) {
        setPending(update);
        setState({
          status: "available",
          version: update.version,
          notes: update.body ?? "",
        });
      } else if (!silent) {
        setState({ status: "uptodate" });
      }
    } catch (err) {
      if (!silent) {
        setState({
          status: "error",
          message: String((err as { message?: string })?.message ?? err),
        });
      }
    }
  }, []);

  const install = useCallback(async () => {
    if (!pending) return;
    setState({ status: "downloading", version: pending.version });
    try {
      await pending.downloadAndInstall();
      setState({ status: "ready" });
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (err) {
      setState({
        status: "error",
        message: String((err as { message?: string })?.message ?? err),
      });
    }
  }, [pending]);

  const dismiss = useCallback(() => setState({ status: "idle" }), []);

  // Check silencioso ao montar; e sob demanda via evento do menu.
  useEffect(() => {
    void check(true);
    const onCheck = () => void check(false);
    window.addEventListener("olimpo:check-updates", onCheck);
    return () => window.removeEventListener("olimpo:check-updates", onCheck);
  }, [check]);

  return { state, install, dismiss };
}
