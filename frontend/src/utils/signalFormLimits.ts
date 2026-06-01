import {
  ACCOUNT_STOP_MIN_STEP,
  accountRiskToPriceStopPct,
  dailyStopRemainingPct,
  priceStopToAccountRiskPct,
  SIGNAL_DAILY_STOP_LIMIT_PCT,
} from "./dailyStopLimit";
import { DEFAULT_RISK_PERCENT, entryNominalUsd, formatRiskPercent } from "./signalForm";
import { DEFAULT_STOP_RISK_PCT, formatRiskPct } from "./signalLevels";

export function accountStopPctFromTracker(dailyLossPct: number | undefined): number | null {
  if (dailyLossPct === undefined) return null;
  const rem = dailyStopRemainingPct(dailyLossPct);
  if (rem < ACCOUNT_STOP_MIN_STEP) return null;
  return Math.min(rem, SIGNAL_DAILY_STOP_LIMIT_PCT);
}

/** Макс. % цены до стопа при полном остатке дневного лимита (% счёта). */
export function maxPriceStopPctFromAccountRemaining(
  dailyRemainingPct: number | undefined,
  balanceUsd: number,
  stakePct: number,
  leverage: number,
): number {
  if (dailyRemainingPct === undefined || dailyRemainingPct < ACCOUNT_STOP_MIN_STEP) return 0;
  if (balanceUsd <= 0 || stakePct <= 0) return 0;
  const accountRisk = Math.min(dailyRemainingPct, SIGNAL_DAILY_STOP_LIMIT_PCT);
  return priceStopPctFromAccountRisk(accountRisk, balanceUsd, stakePct, leverage);
}

/**
 * % движения цены до стопа: риск в $ = balance × accountRisk%, номинал = balance × stake% × lev / 100.
 * Пример: счёт 10k, вход 20% → номинал 2000; риск 0.7% счёта = 70$ → 70/2000 = 3.5% цены.
 * Если на бегунке 0.7% от номинала — передавайте priceStopPct = 0.7 напрямую.
 */
export function priceStopPctFromAccountRisk(
  accountRiskPct: number,
  balanceUsd: number,
  stakePct: number,
  leverage: number,
): number {
  const nominal = entryNominalUsd(balanceUsd, stakePct, leverage);
  if (accountRiskPct < ACCOUNT_STOP_MIN_STEP || nominal <= 0 || balanceUsd <= 0) {
    return DEFAULT_STOP_RISK_PCT;
  }
  const riskUsd = (balanceUsd * accountRiskPct) / 100;
  const pricePct = (riskUsd / nominal) * 100;
  return pricePct > 0 ? pricePct : DEFAULT_STOP_RISK_PCT;
}

/** % счёта при срабатывании стопа на priceStopPct% от номинала. */
export function accountRiskPctFromPriceStop(
  priceStopPct: number,
  balanceUsd: number,
  stakePct: number,
  leverage: number,
): number {
  if (balanceUsd <= 0 || stakePct <= 0) return 0;
  return priceStopToAccountRiskPct(priceStopPct, stakePct, leverage);
}

export function formatPriceRiskFromAccountStop(
  accountRiskPct: number,
  balanceUsd: number,
  stakePct: number,
  leverage: number,
): string {
  return formatRiskPct(priceStopPctFromAccountRisk(accountRiskPct, balanceUsd, stakePct, leverage));
}

/** % цены для полного остатка дневного лимита. */
export function formatPriceRiskForForm(
  dailyLossPct: number | undefined,
  balanceUsd: number,
  stakePct: number,
  leverage: number,
): string {
  if (dailyLossPct === undefined || balanceUsd <= 0) return formatRiskPct(DEFAULT_STOP_RISK_PCT);
  const rem = dailyStopRemainingPct(dailyLossPct);
  return formatRiskPct(maxPriceStopPctFromAccountRemaining(rem, balanceUsd, stakePct, leverage));
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
