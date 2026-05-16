export function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function formatTakeProfits(raw: string | null): string {
  if (!raw) return "";
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

export function statusLabel(status: string): string {
  switch (status) {
    case "win":
      return "WIN";
    case "lose":
      return "LOSE";
    case "active":
      return "Активен";
    default:
      return status;
  }
}

export function traderName(username: string | null, id: number): string {
  return username ? `@${username}` : `id ${id}`;
}
