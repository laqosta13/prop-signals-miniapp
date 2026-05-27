/** Копирование в буфер (Telegram WebView + fallback). */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallback */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function formatDayLabel(isoDate: string) {
  try {
    const d = new Date(isoDate + "T12:00:00");
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Сегодня";
    const y = new Date(today);
    y.setDate(today.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return "Вчера";
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  } catch {
    return isoDate;
  }
}

export function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    if (sameDay) return `Сегодня • ${time}`;
    if (isYesterday) return `Вчера • ${time}`;
    return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function formatTakeProfits(raw: string | null): string {
  if (!raw) return "—";
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    try {
      const arr = JSON.parse(trimmed) as unknown;
      if (Array.isArray(arr)) return arr.map(String).join(", ");
    } catch {
      /* */
    }
  }
  return trimmed;
}

export function normalizeTakeProfits(input: string): string | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("[")) {
    try {
      const arr = JSON.parse(trimmed) as unknown;
      if (Array.isArray(arr)) {
        const levels = arr.map(String).map((s) => s.trim()).filter(Boolean);
        if (levels.length) return levels.join(", ");
      }
    } catch {
      /* */
    }
  }
  const levels = trimmed
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return levels.length ? levels.join(", ") : undefined;
}

export function formatUsd(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export function traderName(username: string | null, id: number, displayName?: string | null) {
  if (displayName) return displayName;
  return username ? `@${username}` : `id ${id}`;
}

export function authorProfile(
  displayName: string | null | undefined,
  username: string | null | undefined,
): { title: string; subtitle: string | null } {
  const login = username ? `@${username}` : null;
  if (displayName && login) return { title: displayName, subtitle: login };
  if (displayName) return { title: displayName, subtitle: null };
  if (login) return { title: login, subtitle: null };
  return { title: "Трейдер", subtitle: null };
}

export function initialsFromAuthor(displayName: string | null | undefined, username: string | null | undefined) {
  const src = displayName || username || "?";
  const clean = src.replace("@", "").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return clean.slice(0, 2).toUpperCase() || "?";
}

/** Абсолютный URL для /media/... при отдельном API-домене (VITE_API_URL). */
export function mediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "";
  return base ? `${base}${url}` : url;
}

export function calcRR(entry: string | null, stop: string | null, target: string | null): string {
  const e = parseFloat((entry || "").replace(",", "."));
  const s = parseFloat((stop || "").replace(",", "."));
  const t = parseFloat((target || "").split(",")[0]?.replace(",", ".") || "");
  if (!e || !s || !t) return "—";
  const risk = Math.abs(e - s);
  const reward = Math.abs(t - e);
  if (risk === 0) return "—";
  return `1:${(reward / risk).toFixed(1)}`;
}

const MARKET_SOURCE_LABELS: Record<string, string> = {
  binance_spot: "Binance spot",
  binance_perp: "Binance perp",
  bybit_spot: "Bybit spot",
  bybit_perp: "Bybit бессрочный",
  bingx_spot: "BingX spot",
  bingx_perp: "BingX perp",
};

export function formatMarketSource(source: string): string {
  return MARKET_SOURCE_LABELS[source] ?? source;
}
