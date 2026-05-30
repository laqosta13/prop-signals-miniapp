export function isYouTubeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname.replace(/^www\./i, "").toLowerCase();
    return h === "youtu.be" || h.endsWith("youtube.com");
  } catch {
    return false;
  }
}

const YT_ID = /^[\w-]{11}$/;

export function youtubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();

    if (host === "youtu.be") {
      const vid = u.pathname.replace(/^\//, "").split("/")[0];
      return YT_ID.test(vid) ? vid : null;
    }

    if (!host.endsWith("youtube.com")) return null;

    const path = u.pathname;
    if (path === "/watch" || path.startsWith("/watch/")) {
      const vid = u.searchParams.get("v");
      return vid && YT_ID.test(vid) ? vid : null;
    }

    for (const prefix of ["/embed/", "/shorts/", "/live/", "/v/"]) {
      if (path.startsWith(prefix)) {
        const vid = path.slice(prefix.length).split("/")[0];
        return YT_ID.test(vid) ? vid : null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;
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
