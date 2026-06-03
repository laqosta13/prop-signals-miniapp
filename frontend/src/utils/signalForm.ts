/** Поля формы сигнала: плечо и сумма входа %. */

import { formatPct } from "./formatPct";

export const LEVERAGE_OPTIONS = [1, 2, 3, 4, 5] as const;
export const MAX_LEVERAGE = 5;
export const DEFAULT_RISK_PERCENT = 10;

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
  return formatPct(value);
}

/** Номинал позиции: счёт × сумма входа % × плечо / 100. */
export function entryNominalUsd(accountUsd: number, riskPercent: number, leverage: number): number {
  if (accountUsd <= 0) return 0;
  const lev = Math.max(1, leverage);
  return (accountUsd * riskPercent * lev) / 100;
}

export function onLeveragePick(newLeverage: number): string {
  return String(Math.min(MAX_LEVERAGE, Math.max(1, newLeverage)));
}
