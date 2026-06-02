import {
  ACCOUNT_STOP_MIN_STEP,
  dailyStopRemainingRankPct,
  dailyStopRemainingUsd,
  maxPriceStopPctFromRankDailyBudget,
  rankNominalUsd,
  SIGNAL_DAILY_STOP_LIMIT_PCT,
} from "./dailyStopLimit";
import { DEFAULT_RISK_PERCENT, formatRiskPercent } from "./signalForm";
import {
  DEFAULT_PRICE_STOP_FROM_ENTRY_PCT,
  formatRiskPct,
  STOP_OFFSET_MIN_PCT,
} from "./signalLevels";

export type RankDailyStopContext = {
  dailyLossUsd: number;
  balanceUsd: number;
  rankMaxStakePct: number;
  stakePct: number;
  leverage: number;
};

function rankNominal(ctx: RankDailyStopContext): number {
  return rankNominalUsd(ctx.balanceUsd, ctx.rankMaxStakePct, ctx.leverage);
}

/** Макс. % цены от входа при текущем остатке дневного лимита (2% от номинала ранга). */
export function maxPriceStopPctForForm(ctx: RankDailyStopContext): number {
  if (ctx.balanceUsd <= 0 || ctx.rankMaxStakePct <= 0 || ctx.stakePct <= 0) {
    return DEFAULT_PRICE_STOP_FROM_ENTRY_PCT;
  }
  return maxPriceStopPctFromRankDailyBudget(
    ctx.dailyLossUsd,
    ctx.balanceUsd,
    ctx.rankMaxStakePct,
    ctx.stakePct,
    ctx.leverage,
  );
}

/** Стартовый % стопа: 2% от цены входа, но не выше дневного остатка. */
export function defaultPriceStopPctForForm(ctx: RankDailyStopContext): number {
  const max = maxPriceStopPctForForm(ctx);
  if (max < ACCOUNT_STOP_MIN_STEP) return STOP_OFFSET_MIN_PCT;
  return Math.min(DEFAULT_PRICE_STOP_FROM_ENTRY_PCT, Math.max(STOP_OFFSET_MIN_PCT, max));
}

export function formatDefaultPriceRiskForForm(ctx: RankDailyStopContext): string {
  return formatRiskPct(defaultPriceStopPctForForm(ctx));
}

export function formatPriceRiskForForm(ctx: RankDailyStopContext): string {
  if (ctx.balanceUsd <= 0) return formatRiskPct(DEFAULT_PRICE_STOP_FROM_ENTRY_PCT);
  return formatRiskPct(maxPriceStopPctForForm(ctx));
}

export function dailyStopRemainingForForm(ctx: RankDailyStopContext): number {
  return dailyStopRemainingRankPct(ctx.dailyLossUsd, rankNominal(ctx));
}

export function dailyStopBudgetRemainingUsd(ctx: RankDailyStopContext): number {
  return dailyStopRemainingUsd(ctx.dailyLossUsd, rankNominal(ctx));
}

/** Доля входа по умолчанию: макс. по рангу и свободному пулу (сумма %, не баланс трекера). */
export function defaultStakePct(maxStakePct: number | undefined): number {
  if (maxStakePct === undefined || maxStakePct <= 0) return DEFAULT_RISK_PERCENT;
  return maxStakePct;
}

export function formatStakeForForm(maxStakePct: number | undefined): string {
  return formatRiskPercent(defaultStakePct(maxStakePct));
}

export { SIGNAL_DAILY_STOP_LIMIT_PCT, rankNominalUsd };
