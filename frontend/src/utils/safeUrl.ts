const ALLOWED_PROTOCOLS = new Set(["https:", "http:"]);

/** Разрешает только http(s) URL для img/video/ссылок из API. */
export function safeExternalUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (!ALLOWED_PROTOCOLS.has(url.protocol)) return null;
    return url.href;
  } catch {
    return null;
  }
}
