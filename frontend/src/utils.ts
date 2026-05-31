export { copyToClipboard, readFromClipboard, selectFieldText } from "./utils/clipboard";

const MSK_TZ = "Europe/Moscow";
const MSK_OFFSET_MINUTES = 180;

function mskDayKey(d: Date): string {
  const parts = new Intl.DateTimeFormat("ru-RU", {
    timeZone: MSK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function parseApiDate(raw: string): Date {
  const s = raw.trim();
  const hasTz = /(?:[zZ]|[+\-]\d{2}:\d{2})$/.test(s);
  return new Date(hasTz ? s : `${s}Z`);
}

export function mskDayBoundsMs(now: Date = new Date()): { startMs: number; endMs: number } {
  // API dates are UTC; this returns UTC ms range for the current MSK day.
  const shiftMs = MSK_OFFSET_MINUTES * 60_000;
  const shiftedNowMs = now.getTime() + shiftMs;
  const shifted = new Date(shiftedNowMs);
  const shiftedStartMs = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  const startMs = shiftedStartMs - shiftMs;
  return { startMs, endMs: startMs + 24 * 60 * 60 * 1000 };
}

export function formatDayLabel(isoDate: string) {
  try {
    const d = new Date(isoDate + "T12:00:00");
    const today = new Date();
    if (mskDayKey(d) === mskDayKey(today)) return "Сегодня";
    const y = new Date(today);
    y.setDate(today.getDate() - 1);
    if (mskDayKey(d) === mskDayKey(y)) return "Вчера";
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", timeZone: MSK_TZ });
  } catch {
    return isoDate;
  }
}

export function formatTime(iso: string) {
  try {
    const d = parseApiDate(iso);
    const now = new Date();
    const sameDay = mskDayKey(d) === mskDayKey(now);
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = mskDayKey(d) === mskDayKey(yesterday);
    const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: MSK_TZ });
    if (sameDay) return `Сегодня • ${time}`;
    if (isYesterday) return `Вчера • ${time}`;
    return d.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short", timeZone: MSK_TZ });
  } catch {
    return iso;
  }
}

export function formatDateTimeMsk(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return parseApiDate(iso).toLocaleString("ru-RU", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: MSK_TZ,
    });
  } catch {
    return "—";
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

export function authorProfile(
  displayName: string | null | undefined,
  username: string | null | undefined,
): { title: string; subtitle: string | null } {
  const name = displayName?.trim();
  const login = username?.trim().replace(/^@/, "") || null;
  if (name) return { title: name, subtitle: null };
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
  if (url.startsWith("/avatars/") || url.startsWith("/brands/")) return url;
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
