/** Уровни вход / стоп / цель для формы сигнала (R:R 1:3). */

export const DEFAULT_STOP_RISK_PCT = 1;
export const REWARD_RISK_RATIO = 3;

export function formatPriceLevel(price: number): string {
  if (!Number.isFinite(price) || price <= 0) return "";
  const abs = Math.abs(price);
  if (abs >= 1000) return price.toFixed(2).replace(/\.?0+$/, "");
  if (abs >= 1) return price.toFixed(4).replace(/\.?0+$/, "");
  return price.toFixed(6).replace(/\.?0+$/, "");
}

export function formatRiskPct(pct: number): string {
  if (!Number.isFinite(pct) || pct <= 0) return String(DEFAULT_STOP_RISK_PCT);
  const rounded = Math.round(pct * 100) / 100;
  return String(rounded).replace(/\.?0+$/, "");
}

export function parseEntryPrice(raw: string): number | null {
  const n = parseFloat(raw.trim().replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function parseRiskPctValue(raw: string): number {
  const n = parseFloat(raw.trim().replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_STOP_RISK_PCT;
  return n;
}

/** Стоп на riskPct% от входа, цель на riskPct × 3% (R:R 1:3). */
export function levelsFromEntryAndRisk(
  entry: number,
  direction: "long" | "short",
  riskPct: number = DEFAULT_STOP_RISK_PCT,
): { entry: string; stop: string; target: string } {
  const risk = riskPct / 100;
  const reward = risk * REWARD_RISK_RATIO;
  if (direction === "long") {
    return {
      entry: formatPriceLevel(entry),
      stop: formatPriceLevel(entry * (1 - risk)),
      target: formatPriceLevel(entry * (1 + reward)),
    };
  }
  return {
    entry: formatPriceLevel(entry),
    stop: formatPriceLevel(entry * (1 + risk)),
    target: formatPriceLevel(entry * (1 - reward)),
  };
}

export function stopTargetFromEntryAndRisk(
  entryRaw: string,
  direction: "long" | "short",
  riskPct: number,
): { stop: string; target: string } | null {
  const entry = parseEntryPrice(entryRaw);
  if (entry === null) return null;
  const levels = levelsFromEntryAndRisk(entry, direction, riskPct);
  return { stop: levels.stop, target: levels.target };
}

/** % риска от входа до стопа (для подстановки в поле %). */
export function riskPctFromEntryStop(
  entryRaw: string,
  stopRaw: string,
  direction: "long" | "short",
): number | null {
  const entry = parseEntryPrice(entryRaw);
  const stop = parseEntryPrice(stopRaw);
  if (entry === null || stop === null) return null;
  let pct: number;
  if (direction === "long") {
    if (stop >= entry) return null;
    pct = ((entry - stop) / entry) * 100;
  } else {
    if (stop <= entry) return null;
    pct = ((stop - entry) / entry) * 100;
  }
  if (!Number.isFinite(pct) || pct <= 0) return null;
  return pct;
}

/** @deprecated use levelsFromEntryAndRisk */
export const DEFAULT_LEVEL_OFFSET_PCT = DEFAULT_STOP_RISK_PCT;

export function defaultLevelsFromEntry(
  entry: number,
  direction: "long" | "short",
  offsetPct: number = DEFAULT_STOP_RISK_PCT,
): { entry: string; stop: string; target: string } {
  return levelsFromEntryAndRisk(entry, direction, offsetPct);
}

export function stopTargetFromEntry(
  entryRaw: string,
  direction: "long" | "short",
): { stop: string; target: string } | null {
  return stopTargetFromEntryAndRisk(entryRaw, direction, DEFAULT_STOP_RISK_PCT);
}
