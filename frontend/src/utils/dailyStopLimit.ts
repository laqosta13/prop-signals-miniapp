/** Дневной лимит риска до стопа (% от счёта трекера) в форме сигнала. */
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

/** Макс. % движения цены до стопа при полном остатке дневного лимита (% счёта). */
export function maxPriceStopPctFromDailyRemaining(
  dailyRemainingPct: number,
  stakePct: number,
  leverage: number,
): number {
  if (dailyRemainingPct < ACCOUNT_STOP_MIN_STEP || stakePct <= 0 || leverage < 1) return 0;
  return accountRiskToPriceStopPct(dailyRemainingPct, stakePct, leverage);
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

export function isDailyStopBudgetExhausted(dailyLossPct: number): boolean {
  return dailyStopRemainingPct(dailyLossPct) < ACCOUNT_STOP_MIN_STEP;
}

export function isDailyTradesExhausted(count: number, limit = SIGNAL_DAILY_TRADE_LIMIT): boolean {
  return dailyTradesRemaining(count, limit) <= 0;
}

export function dailyTradingBlocked(opts: {
  dailyLossPct: number;
  dailyTradesCount: number;
  dailyTradesLimit?: number;
}): { blocked: boolean; reason: "stop" | "trades" | null } {
  if (isDailyStopBudgetExhausted(opts.dailyLossPct)) {
    return { blocked: true, reason: "stop" };
  }
  if (isDailyTradesExhausted(opts.dailyTradesCount, opts.dailyTradesLimit)) {
    return { blocked: true, reason: "trades" };
  }
  return { blocked: false, reason: null };
}

export function dailyLimitBlockedMessage(reason: "stop" | "trades" | null): string {
  if (reason === "stop") {
    return `Дневной лимит ${SIGNAL_DAILY_STOP_LIMIT_PCT}% стопа исчерпан — торговля сегодня недоступна`;
  }
  if (reason === "trades") {
    return `Лимит ${SIGNAL_DAILY_TRADE_LIMIT} сделок в день исчерпан — торговля сегодня недоступна`;
  }
  return `Лимит дня: ${SIGNAL_DAILY_TRADE_LIMIT} сделки или ${SIGNAL_DAILY_STOP_LIMIT_PCT}% стопа`;
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
  const max = Math.max(0, maxRemainingPct);
  if (max < ACCOUNT_STOP_MIN_STEP) return 0;
  if (accountRiskPct <= 0) return 0;
  return roundStopPct(Math.min(max, Math.max(ACCOUNT_STOP_MIN_STEP, accountRiskPct)));
}
