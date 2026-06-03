import WebApp from "@twa-dev/sdk";

/** Подтверждение действия (Telegram Mini App или браузер). */
export function confirmAction(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const showConfirm = (
      WebApp as typeof WebApp & { showConfirm?: (msg: string, cb: (ok: boolean) => void) => void }
    ).showConfirm;
    if (typeof showConfirm === "function") {
      showConfirm(message, resolve);
      return;
    }
    resolve(window.confirm(message));
  });
}
