import {
  ACCOUNT_STOP_MIN_STEP,
  accountRiskToPriceStopPct,
  dailyStopRemainingPct,
  SIGNAL_DAILY_STOP_LIMIT_PCT,
} from "./dailyStopLimit";
import { DEFAULT_RISK_PERCENT, formatRiskPercent } from "./signalForm";
import { DEFAULT_STOP_RISK_PCT, formatRiskPct } from "./signalLevels";

export function accountStopPctFromTracker(dailyLossPct: number | undefined): number | null {
  if (dailyLossPct === undefined) return null;
  const rem = dailyStopRemainingPct(dailyLossPct);
  if (rem < ACCOUNT_STOP_MIN_STEP) return null;
  return Math.min(rem, SIGNAL_DAILY_STOP_LIMIT_PCT);
}

/** % движения цены до стопа из % риска счёта (без усечения 5% — иначе бегунок не доходит до остатка). */
export function priceStopPctFromAccountRisk(
  accountRiskPct: number,
  stakePct: number,
  leverage: number,
): number {
  if (accountRiskPct < ACCOUNT_STOP_MIN_STEP || stakePct <= 0) return DEFAULT_STOP_RISK_PCT;
  const pricePct = accountRiskToPriceStopPct(accountRiskPct, stakePct, leverage);
  return pricePct > 0 ? pricePct : DEFAULT_STOP_RISK_PCT;
}

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
  return priceStopPctFromAccountRisk(accountRisk, stakePct, leverage);
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

export function formatPriceRiskFromAccountStop(
  accountRiskPct: number,
  stakePct: number,
  leverage: number,
): string {
  return formatRiskPct(priceStopPctFromAccountRisk(accountRiskPct, stakePct, leverage));
}

/** Сумма входа %: по умолчанию максимум (при полном пуле — 100% в пределах ранга). */
export function defaultStakePct(
  maxStakePct: number | undefined,
  poolRemainingPct?: number,
): number {
  if (maxStakePct === undefined || maxStakePct <= 0) return DEFAULT_RISK_PERCENT;
  if (poolRemainingPct != null && poolRemainingPct >= 99.5) {
    return Math.min(100, maxStakePct);
  }
  return maxStakePct;
}

export function formatStakeForForm(
  maxStakePct: number | undefined,
  poolRemainingPct?: number,
): string {
  return formatRiskPercent(defaultStakePct(maxStakePct, poolRemainingPct));
}
