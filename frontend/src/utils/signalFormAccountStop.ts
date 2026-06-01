import { ACCOUNT_STOP_MIN_STEP, priceStopToAccountRiskPct } from "./dailyStopLimit";
import { formatPriceRiskFromAccountStop } from "./signalFormLimits";
import { formatRiskPct, parseRiskPctValue } from "./signalLevels";

/** Пересчёт % цены стопа при смене доли входа / плеча (сохраняем % риска счёта). */
export function preserveAccountStopOnPositionChange(opts: {
  accountStopPct: number;
  balanceUsd: number;
  nextStakePct: number;
  nextLeverage: number;
}): string | null {
  if (opts.accountStopPct < ACCOUNT_STOP_MIN_STEP || opts.balanceUsd <= 0 || opts.nextStakePct <= 0) {
    return null;
  }
  return formatPriceRiskFromAccountStop(
    opts.accountStopPct,
    opts.balanceUsd,
    opts.nextStakePct,
    opts.nextLeverage,
  );
}

export function priceRiskLabelFromPriceStop(priceStopPct: number): string {
  return formatRiskPct(priceStopPct);
}

export function inferAccountStopFromPriceRisk(
  riskPct: string,
  balanceUsd: number,
  stakePct: number,
  leverage: number,
): number | null {
  const price = parseRiskPctValue(riskPct);
  const account = priceStopToAccountRiskPct(price, stakePct, leverage);
  if (account < ACCOUNT_STOP_MIN_STEP) return null;
  return account;
}
