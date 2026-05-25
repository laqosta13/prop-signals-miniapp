import type { HashHedgeRules } from "../api";

/** Статические правила Hash Hedge — без лишнего запроса при открытии трекера. */
export const HASHHEDGE_RULES: HashHedgeRules = {
  firm: "Hash Hedge",
  url: "https://www.hashhedge.com/",
  account_sizes: [5000, 10000, 25000, 50000, 100000, 150000],
  stages: [
    {
      stage: 1,
      profit_target_pct: 8,
      profit_target_unlimited: false,
      max_daily_loss_pct: 5,
      max_drawdown_pct: 10,
      min_trading_days: 5,
      min_trading_days_unlimited: false,
      trading_period_unlimited: true,
      max_leverage: "1:5",
    },
    {
      stage: 2,
      profit_target_pct: 6,
      profit_target_unlimited: false,
      max_daily_loss_pct: 5,
      max_drawdown_pct: 8,
      min_trading_days: 5,
      min_trading_days_unlimited: false,
      trading_period_unlimited: true,
      max_leverage: "1:5",
    },
    {
      stage: 3,
      profit_target_pct: null,
      profit_target_unlimited: true,
      max_daily_loss_pct: 5,
      max_drawdown_pct: 8,
      min_trading_days: null,
      min_trading_days_unlimited: true,
      trading_period_unlimited: true,
      max_leverage: "1:5",
    },
  ],
  table_rows: [
    {
      id: "profit_target",
      label: "Целевая прибыль",
      hint: "Процент прибыли от стартового баланса для перехода на следующий этап.",
      values: ["8%", "6%", "∞"],
    },
    {
      id: "max_daily_loss",
      label: "Максимальная потеря в день",
      hint: "Максимальный убыток за торговый день в % от баланса на начало дня.",
      values: ["5%", "5%", "5%"],
    },
    {
      id: "max_drawdown",
      label: "Макс просадка",
      hint: "Максимальная просадка от начального депозита челленджа.",
      values: ["10%", "8%", "8%"],
    },
    {
      id: "min_trading_days",
      label: "Мин. торговые дни",
      hint: "Минимальное число дней с хотя бы одной сделкой для прохождения этапа.",
      values: ["5", "5", "∞"],
    },
    {
      id: "trading_period",
      label: "Торговый период",
      hint: "Срок прохождения этапа; без ограничения по времени.",
      values: ["∞", "∞", "∞"],
    },
    {
      id: "max_leverage",
      label: "Максимальное кредитное плечо",
      hint: "Допустимое плечо на крипто-парах.",
      values: ["1:5", "1:5", "1:5"],
    },
  ],
};
