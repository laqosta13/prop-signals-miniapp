/** Обратный отсчёт до полуночи MSK (сброс дневных лимитов формы). */

export function msUntilMskMidnight(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Moscow",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const h = get("hour");
  const m = get("minute");
  const s = get("second");
  const elapsedMs = ((h * 60 + m) * 60 + s) * 1000;
  return Math.max(0, 86_400_000 - elapsedMs);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** HH:MM:SS до нового дня по МСК. */
export function formatMskDayCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}
