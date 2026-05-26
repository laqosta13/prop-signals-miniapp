/** Поля формы сигнала: плечо и сумма входа %. */

export const LEVERAGE_OPTIONS = [1, 2, 3, 4, 5] as const;
export const MAX_LEVERAGE = 5;

export function parseLeverage(raw: string): number {
  const n = parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_LEVERAGE);
}

export function parseRiskPercent(raw: string): number {
  const n = parseFloat(raw.trim().replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 100);
}

export function formatRiskPercent(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(2).replace(/\.?0+$/, "");
}

/** Сумма входа % масштабируется пропорционально плечу (номинал растёт с плечом). */
export function riskForLeverageChange(currentRisk: number, oldLeverage: number, newLeverage: number): number {
  if (oldLeverage <= 0 || newLeverage <= 0) return currentRisk;
  const scaled = (currentRisk * newLeverage) / oldLeverage;
  return Math.min(100, Math.max(0, scaled));
}

export function entryNominalUsd(tracker: number, riskPercent: number): number {
  if (tracker <= 0) return 0;
  return (tracker * riskPercent) / 100;
}

export function onLeverageFieldChange(
  newLeverageRaw: string,
  prevLeverageRaw: string,
  riskRaw: string,
): { leverage: string; risk: string } {
  const oldLev = parseLeverage(prevLeverageRaw);
  const newLev = parseLeverage(newLeverageRaw);
  const risk = parseRiskPercent(riskRaw);
  const nextRisk = riskForLeverageChange(risk, oldLev, newLev);
  return {
    leverage: String(newLev),
    risk: formatRiskPercent(nextRisk),
  };
}
