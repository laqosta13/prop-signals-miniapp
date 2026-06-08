import WebApp from "@twa-dev/sdk";
import { safeExternalUrl } from "./safeUrl";

/** Открыть внешнюю или Telegram-ссылку из Mini App. */
export function openExternalLink(url: string): void {
  const safe = safeExternalUrl(url);
  if (!safe) return;
  WebApp.HapticFeedback.impactOccurred("light");
  if (safe.includes("t.me/") && typeof WebApp.openTelegramLink === "function") {
    WebApp.openTelegramLink(safe);
    return;
  }
  if (typeof WebApp.openLink === "function") {
    WebApp.openLink(safe);
    return;
  }
  window.open(safe, "_blank", "noopener,noreferrer");
}
