import WebApp from "@twa-dev/sdk";
import { safeExternalUrl } from "./safeUrl";

type OpenLinkOptions = {
  try_instant_view?: boolean;
};

/** Открыть ссылку: в Telegram — встроенный браузер клиента (openLink), иначе новая вкладка. */
export function openExternalLink(url: string): void {
  const safe = safeExternalUrl(url);
  if (!safe) return;
  WebApp.HapticFeedback.impactOccurred("light");
  if (safe.includes("t.me/") && typeof WebApp.openTelegramLink === "function") {
    WebApp.openTelegramLink(safe);
    return;
  }
  const openLink = WebApp.openLink as ((link: string, options?: OpenLinkOptions) => void) | undefined;
  if (typeof openLink === "function") {
    openLink(safe);
    return;
  }
  window.open(safe, "_blank", "noopener,noreferrer");
}
