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

export function traderName(username: string | null, id: number) {
  return username ? `@${username}` : `id ${id}`;
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
