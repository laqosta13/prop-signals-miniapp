import WebApp from "@twa-dev/sdk";

/** Открыть внешнюю или Telegram-ссылку из Mini App. */
export function openExternalLink(url: string): void {
  WebApp.HapticFeedback.impactOccurred("light");
  if (url.includes("t.me/") && typeof WebApp.openTelegramLink === "function") {
    WebApp.openTelegramLink(url);
    return;
  }
  if (typeof WebApp.openLink === "function") {
    WebApp.openLink(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
