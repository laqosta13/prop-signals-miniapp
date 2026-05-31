/** Дневной лимит риска до стопа (% от счёта трекера) в форме сигнала. */
export const SIGNAL_DAILY_STOP_LIMIT_PCT = 2;

export function roundStopPct(pct: number): number {
  return Math.round(pct * 100) / 100;
}

export function dailyStopRemainingPct(dailyLossPct: number): number {
  return roundStopPct(Math.max(0, SIGNAL_DAILY_STOP_LIMIT_PCT - Math.max(0, dailyLossPct)));
}

/** % движения цены до стопа → % потери счёта при срабатывании стопа. */
export function priceStopToAccountRiskPct(
  priceStopPct: number,
  stakePct: number,
  leverage: number,
): number {
  if (!Number.isFinite(priceStopPct) || priceStopPct <= 0) return 0;
  return roundStopPct((priceStopPct * stakePct * leverage) / 100);
}

/** % потери счёта → % движения цены до стопа. */
export function accountRiskToPriceStopPct(
  accountRiskPct: number,
  stakePct: number,
  leverage: number,
): number {
  const denom = stakePct * leverage;
  if (!Number.isFinite(accountRiskPct) || accountRiskPct <= 0 || denom <= 0) return 0;
  return roundStopPct((accountRiskPct * 100) / denom);
}

export function clampAccountStopRisk(accountRiskPct: number, maxRemainingPct: number): number {
  const min = 0.1;
  const max = Math.max(0, maxRemainingPct);
  if (max < min) return 0;
  return roundStopPct(Math.min(max, Math.max(min, accountRiskPct)));
}
