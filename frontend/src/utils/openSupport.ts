import WebApp from "@twa-dev/sdk";
import { openExternalLink } from "./openExternalLink";

export function openSupportChat(url: string): void {
  if (!url) return;
  openExternalLink(url);
  WebApp.HapticFeedback.impactOccurred("light");
}
