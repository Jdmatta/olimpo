import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

/** Toast nativo do Windows — fail-silent fora do Tauri. */
export function notify(title: string, body: string): void {
  void (async () => {
    try {
      let granted = await isPermissionGranted();
      if (!granted) {
        granted = (await requestPermission()) === "granted";
      }
      if (granted) {
        sendNotification({ title, body });
      }
    } catch {
      // dev no browser: sem notificação nativa
    }
  })();
}
