import {
  ACCOUNT_STOP_MIN_STEP,
  accountRiskToPriceStopPct,
  dailyStopRemainingPct,
  SIGNAL_DAILY_STOP_LIMIT_PCT,
} from "./dailyStopLimit";
import { DEFAULT_RISK_PERCENT, formatRiskPercent } from "./signalForm";
import { clampStopOffsetPct, DEFAULT_STOP_RISK_PCT, formatRiskPct } from "./signalLevels";

/** % движения цены до стопа: остаток дневного лимита → R:R 1:3 в стоп/цель. */
export function priceStopPctForDailyLimit(
  dailyRemainingPct: number | undefined,
  stakePct: number,
  leverage: number,
): number {
  if (dailyRemainingPct === undefined || dailyRemainingPct < ACCOUNT_STOP_MIN_STEP) {
    return DEFAULT_STOP_RISK_PCT;
  }
  const accountRisk = Math.min(dailyRemainingPct, SIGNAL_DAILY_STOP_LIMIT_PCT);
  const pricePct = accountRiskToPriceStopPct(accountRisk, stakePct, leverage);
  return clampStopOffsetPct(pricePct > 0 ? pricePct : DEFAULT_STOP_RISK_PCT);
}

export function priceStopPctFromTracker(
  dailyLossPct: number | undefined,
  stakePct: number,
  leverage: number,
): number {
  if (dailyLossPct === undefined) return DEFAULT_STOP_RISK_PCT;
  return priceStopPctForDailyLimit(dailyStopRemainingPct(dailyLossPct), stakePct, leverage);
}

export function formatPriceRiskForForm(
  dailyLossPct: number | undefined,
  stakePct: number,
  leverage: number,
): string {
  return formatRiskPct(priceStopPctFromTracker(dailyLossPct, stakePct, leverage));
}

/** Сумма входа %: по умолчанию весь доступный остаток пула (с учётом ранга). */
export function defaultStakePct(maxStakePct: number | undefined): number {
  if (maxStakePct === undefined || maxStakePct <= 0) return DEFAULT_RISK_PERCENT;
  return maxStakePct;
}

export function formatStakeForForm(maxStakePct: number | undefined): string {
  return formatRiskPercent(defaultStakePct(maxStakePct));
}
