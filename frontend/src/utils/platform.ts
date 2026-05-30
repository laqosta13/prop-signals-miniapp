import WebApp from "@twa-dev/sdk";

/** Telegram Desktop / macOS client — там WebView часто ломает Ctrl+V и раскладку (Linux Wayland). */
export function isTelegramDesktop(): boolean {
  const p = WebApp.platform;
  return p === "tdesktop" || p === "macos" || p === "unigram";
}
