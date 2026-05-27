import WebApp from "@twa-dev/sdk";
import { copyToClipboard } from "../utils";

export function telegramShareUrl(link: string, text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
}

export function openReferralShare(link: string, text: string): void {
  const url = telegramShareUrl(link, text);
  if (WebApp.openTelegramLink) {
    WebApp.openTelegramLink(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export async function copyReferralLink(link: string, text: string): Promise<boolean> {
  const payload = `${text}\n\n${link}`;
  return copyToClipboard(payload);
}
