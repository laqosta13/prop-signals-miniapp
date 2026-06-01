/** Уровни вход / стоп / цель для формы сигнала (R:R 1:3). Стоп и цель всегда от цены входа. */

/** Стартовое значение бегунка «До стопа» — % от номинала (≈ % цены от входа). */
export const DEFAULT_NOMINAL_STOP_PCT = 0.7;
export const DEFAULT_STOP_RISK_PCT = DEFAULT_NOMINAL_STOP_PCT;
export const REWARD_RISK_RATIO = 3;
export const STOP_OFFSET_MIN_PCT = 0.1;
export const STOP_OFFSET_MAX_PCT = 5;
export const STOP_OFFSET_STEP = 0.1;
export const STOP_OFFSET_MARKS = [0.5, 1, 1.5, 2, 3, 5] as const;

export function clampStopOffsetPct(pct: number): number {
  if (!Number.isFinite(pct) || pct <= 0) return DEFAULT_STOP_RISK_PCT;
  return Math.min(STOP_OFFSET_MAX_PCT, Math.max(STOP_OFFSET_MIN_PCT, pct));
}

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
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
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
  /** % движения цены от входа до стопа. */
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
