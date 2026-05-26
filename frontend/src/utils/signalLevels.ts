/** Уровни вход / стоп / цель для формы сигнала. */

export const DEFAULT_LEVEL_OFFSET_PCT = 1;

export function formatPriceLevel(price: number): string {
  if (!Number.isFinite(price) || price <= 0) return "";
  const abs = Math.abs(price);
  if (abs >= 1000) return price.toFixed(2).replace(/\.?0+$/, "");
  if (abs >= 1) return price.toFixed(4).replace(/\.?0+$/, "");
  return price.toFixed(6).replace(/\.?0+$/, "");
}

export function parseEntryPrice(raw: string): number | null {
  const n = parseFloat(raw.trim().replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function defaultLevelsFromEntry(
  entry: number,
  direction: "long" | "short",
  offsetPct: number = DEFAULT_LEVEL_OFFSET_PCT,
): { entry: string; stop: string; target: string } {
  const k = offsetPct / 100;
  if (direction === "long") {
    return {
      entry: formatPriceLevel(entry),
      stop: formatPriceLevel(entry * (1 - k)),
      target: formatPriceLevel(entry * (1 + k)),
    };
  }
  return {
    entry: formatPriceLevel(entry),
    stop: formatPriceLevel(entry * (1 + k)),
    target: formatPriceLevel(entry * (1 - k)),
  };
}

export function stopTargetFromEntry(
  entryRaw: string,
  direction: "long" | "short",
): { stop: string; target: string } | null {
  const entry = parseEntryPrice(entryRaw);
  if (entry === null) return null;
  const levels = defaultLevelsFromEntry(entry, direction);
  return { stop: levels.stop, target: levels.target };
}
