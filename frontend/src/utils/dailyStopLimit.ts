/** Дневной лимит стопа: 2% от номинала ранга (счёт × лимит ранга % × плечо). */
export const SIGNAL_DAILY_STOP_LIMIT_PCT = 2;

/** Максимум публикуемых сигналов (сделок) в день на трейдера. */
export const SIGNAL_DAILY_TRADE_LIMIT = 3;

/** Минимальный осмысленный шаг риска на бегунке (% счёта). */
export const ACCOUNT_STOP_MIN_STEP = 0.01;

export function dailyTradesRemaining(count: number, limit = SIGNAL_DAILY_TRADE_LIMIT): number {
  return Math.max(0, limit - Math.max(0, count));
}

export function roundStopPct(pct: number): number {
  return Math.round(pct * 100) / 100;
}

/** Формат % счёта на бегунке стопа (0 остаётся 0). */
export function formatAccountStopPct(pct: number): string {
  if (!Number.isFinite(pct) || pct < 0) return "0";
  const rounded = roundStopPct(pct);
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

/** Номинал по рангу: макс. сумма входа % ранга × плечо. */
export function rankNominalUsd(balanceUsd: number, rankMaxStakePct: number, leverage: number): number {
  if (balanceUsd <= 0 || rankMaxStakePct <= 0 || leverage < 1) return 0;
  return roundStopPct((balanceUsd * rankMaxStakePct * leverage) / 100);
}

export function dailyStopBudgetUsd(rankNominalUsd: number): number {
  return roundStopPct((rankNominalUsd * SIGNAL_DAILY_STOP_LIMIT_PCT) / 100);
}

/** Остаток лимита 2% в «процентах от номинала ранга» (0–2). */
export function dailyStopRemainingRankPct(dailyLossUsd: number, rankNominalUsd: number): number {
  if (rankNominalUsd <= 0) return 0;
  const usedPct = (dailyLossUsd / rankNominalUsd) * 100;
  return roundStopPct(Math.max(0, SIGNAL_DAILY_STOP_LIMIT_PCT - usedPct));
}

export function dailyStopRemainingUsd(dailyLossUsd: number, rankNominalUsd: number): number {
  return roundStopPct(Math.max(0, dailyStopBudgetUsd(rankNominalUsd) - dailyLossUsd));
}

/** @deprecated остаток от % счёта; в форме — dailyStopRemainingRankPct */
export function dailyStopRemainingPct(dailyLossPct: number): number {
  return roundStopPct(Math.max(0, SIGNAL_DAILY_STOP_LIMIT_PCT - Math.max(0, dailyLossPct)));
}

export function accountStopSliderStep(_remaining?: number): number {
  return ACCOUNT_STOP_MIN_STEP;
}

/** Метки бегунка: равномерно от 0 до максимума (на весь трек). */
export function accountStopSliderMarks(remaining: number, limit = SIGNAL_DAILY_STOP_LIMIT_PCT): number[] {
  const max = roundStopPct(Math.max(0, remaining));
  if (max < ACCOUNT_STOP_MIN_STEP) return [];
  if (max >= limit - 0.001) {
    return [0.5, 1, 1.5, limit].filter((m) => m <= max + 0.001);
  }
  if (max <= 0.15) return [max];
  const parts = [0.25, 0.5, 0.75, 1].map((f) => roundStopPct(max * f));
  return parts.filter((m, i, arr) => i === 0 || m > arr[i - 1] + 0.009);
}

/** Макс. % цены от входа при полном остатке дневного лимита (2% от номинала ранга). */
export function maxPriceStopPctFromRankDailyBudget(
  dailyLossUsd: number,
  balanceUsd: number,
  rankMaxStakePct: number,
  stakePct: number,
  leverage: number,
): number {
  const rankNominal = rankNominalUsd(balanceUsd, rankMaxStakePct, leverage);
  if (rankNominal <= 0 || balanceUsd <= 0 || stakePct <= 0 || leverage < 1) return 0;
  const remainingUsd = dailyStopRemainingUsd(dailyLossUsd, rankNominal);
  const maxAccountRisk = (remainingUsd / balanceUsd) * 100;
  return accountRiskToPriceStopPct(maxAccountRisk, stakePct, leverage);
}

/** Макс. % цены при остатке лимита в «% от номинала ранга» (0–2). */
export function maxPriceStopPctFromDailyRemaining(
  dailyRemainingRankPct: number,
  balanceUsd: number,
  rankMaxStakePct: number,
  stakePct: number,
  leverage: number,
): number {
  if (dailyRemainingRankPct < ACCOUNT_STOP_MIN_STEP || stakePct <= 0 || leverage < 1) return 0;
  const rankNominal = rankNominalUsd(balanceUsd, rankMaxStakePct, leverage);
  if (rankNominal <= 0 || balanceUsd <= 0) return 0;
  const remainingUsd = (dailyRemainingRankPct / 100) * rankNominal;
  const maxAccountRisk = (remainingUsd / balanceUsd) * 100;
  return accountRiskToPriceStopPct(maxAccountRisk, stakePct, leverage);
}

const PRICE_STOP_MARK_PRESETS = [0.5, 0.7, 1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10] as const;

/**
 * Метки бегунка «До стопа»: доли остатка дневного лимита (% счёта), переведённые в % цены.
 */
export function priceStopSliderMarksFromDailyRemaining(
  dailyRemainingPct: number,
  stakePct: number,
  leverage: number,
): number[] {
  const maxPrice = maxPriceStopPctFromDailyRemaining(dailyRemainingPct, stakePct, leverage);
  if (maxPrice < ACCOUNT_STOP_MIN_STEP) return [];

  const accountMarks = accountStopSliderMarks(dailyRemainingPct);
  const priceMarks = accountMarks
    .map((m) => accountRiskToPriceStopPct(m, stakePct, leverage))
    .filter((m) => m >= ACCOUNT_STOP_MIN_STEP - 0.001 && m <= maxPrice + 0.001);

  const uniq = priceMarks.filter((m, i, arr) => i === 0 || m > arr[i - 1] + 0.009);
  const last = uniq[uniq.length - 1];
  if (last == null || last < maxPrice - 0.009) {
    uniq.push(roundStopPct(maxPrice));
  }
  return uniq;
}

/** Метки бегунка «% от номинала» — привычные шаги, если влезают в max. */
export function priceStopSliderMarks(maxPricePct: number): number[] {
  const max = roundStopPct(Math.max(0, maxPricePct));
  if (max < ACCOUNT_STOP_MIN_STEP) return [];
  const preset = PRICE_STOP_MARK_PRESETS.filter((m) => m <= max + 0.001);
  if (preset.length >= 2) {
    const last = preset[preset.length - 1];
    if (last < max - 0.009) preset.push(max);
    return [...preset];
  }
  if (max <= 0.15) return [max];
  const parts = [0.25, 0.5, 0.75, 1].map((f) => roundStopPct(max * f));
  const marks = parts.filter((m, i, arr) => i === 0 || m > arr[i - 1] + 0.009);
  const last = marks[marks.length - 1];
  if (last < max - 0.009) marks.push(max);
  return marks;
}

export function isDailyStopBudgetExhaustedRank(
  dailyLossUsd: number,
  rankNominalUsd: number,
): boolean {
  return dailyStopRemainingRankPct(dailyLossUsd, rankNominalUsd) < ACCOUNT_STOP_MIN_STEP;
}

export function isDailyStopBudgetExhausted(dailyLossPct: number): boolean {
  return dailyStopRemainingPct(dailyLossPct) < ACCOUNT_STOP_MIN_STEP;
}

export function isDailyTradesExhausted(count: number, limit = SIGNAL_DAILY_TRADE_LIMIT): boolean {
  return dailyTradesRemaining(count, limit) <= 0;
}

export function dailyTradingBlocked(opts: {
  dailyLossUsd: number;
  rankNominalUsd: number;
  dailyTradesCount: number;
  dailyTradesLimit?: number;
}): { blocked: boolean; reason: "stop" | "trades" | null } {
  if (isDailyStopBudgetExhaustedRank(opts.dailyLossUsd, opts.rankNominalUsd)) {
    return { blocked: true, reason: "stop" };
  }
  if (isDailyTradesExhausted(opts.dailyTradesCount, opts.dailyTradesLimit)) {
    return { blocked: true, reason: "trades" };
  }
  return { blocked: false, reason: null };
}

export function dailyLimitBlockedMessage(reason: "stop" | "trades" | null): string {
  if (reason === "stop") {
    return `Дневной лимит ${SIGNAL_DAILY_STOP_LIMIT_PCT}% стопа от номинала ранга исчерпан — торговля сегодня недоступна`;
  }
  if (reason === "trades") {
    return `Лимит ${SIGNAL_DAILY_TRADE_LIMIT} сделок в день исчерпан — торговля сегодня недоступна`;
  }
  return `Лимит дня: ${SIGNAL_DAILY_TRADE_LIMIT} сделки или ${SIGNAL_DAILY_STOP_LIMIT_PCT}% стопа от номинала ранга`;
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

/**
 * Смена плеча при той же доле входа: риск счёта на стопе тот же → % цены до стопа обратно пропорционален плечу.
 * Плечо 2× → путь цены до стопа в 2 раза короче.
 */
export function priceStopPctPreservingAccountRisk(
  priceStopPct: number,
  stakePct: number,
  prevLeverage: number,
  newLeverage: number,
): number {
  if (stakePct <= 0 || newLeverage < 1) return priceStopPct;
  const account = priceStopToAccountRiskPct(priceStopPct, stakePct, Math.max(1, prevLeverage));
  if (account <= 0) return priceStopPct;
  return accountRiskToPriceStopPct(account, stakePct, newLeverage);
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
  const max = Math.max(0, maxRemainingPct);
  if (max < ACCOUNT_STOP_MIN_STEP) return 0;
  if (accountRiskPct <= 0) return 0;
  return roundStopPct(Math.min(max, Math.max(ACCOUNT_STOP_MIN_STEP, accountRiskPct)));
}
