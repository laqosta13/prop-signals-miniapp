export function isYouTubeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname.replace(/^www\./i, "").toLowerCase();
    return h === "youtu.be" || h.endsWith("youtube.com");
  } catch {
    return false;
  }
}

export function linkSiteName(url: string): string {
  try {
    const u = new URL(url);
    const h = u.hostname.replace(/^www\./i, "").toLowerCase();
    if (h === "youtu.be" || h.endsWith("youtube.com")) return "YouTube";
    if (h === "x.com" || h.endsWith("twitter.com")) return "X";
    if (h.endsWith("instagram.com")) return "Instagram";
    if (h === "t.me") return "Telegram";
    if (h.endsWith("vk.com")) return "VK";
    const parts = h.split(".");
    if (parts.length >= 2) {
      const name = parts[parts.length - 2];
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
    return h;
  } catch {
    return url;
  }
}
