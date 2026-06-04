import type { Signal } from "../api";
import {
  chartEntryReference,
  levelMovePctFromEntry,
  levelsFromSignal,
  parseLevelPrice,
  parseTakeProfitPrices,
} from "./signalChartLevels";

const DEFAULT_STAKE_PCT = 10;
const MAX_LEVERAGE = 5;

/** Та же база входа, что на графике: лимит → иначе рынок при публикации. */
function entryPrice(s: Signal): number | null {
  const lv = levelsFromSignal(s.entry_low, s.entry_high, s.stop_loss, s.take_profits);
  return chartEntryReference(lv, s.published_market_price);
}

/** % от входа до стопа (как подпись «Стоп …%» на графике). */
export function signalStopMovePct(s: Signal): number | null {
  const entry = entryPrice(s);
  const stop = parseLevelPrice(s.stop_loss);
  if (entry == null || stop == null) return null;
  const dir = s.direction === "short" ? "short" : "long";
  return levelMovePctFromEntry(entry, dir, stop);
}

function exitPrice(s: Signal): number | null {
  if (s.closed_exit_price != null && Number.isFinite(s.closed_exit_price)) {
    return s.closed_exit_price;
  }
  if (s.status !== "win" && s.status !== "lose") return null;
  if (s.status === "lose") {
    return parseLevelPrice(s.stop_loss);
  }
  const tps = parseTakeProfitPrices(s.take_profits);
  if (tps.length) {
    return s.direction === "short" ? Math.max(...tps) : Math.min(...tps);
  }
  return parseLevelPrice(s.take_profits);
}

function priceMovePct(s: Signal): number | null {
  const entry = entryPrice(s);
  const exit = exitPrice(s);
  if (entry == null || exit == null || entry <= 0) return null;
  const dir = s.direction === "short" ? "short" : "long";
  return levelMovePctFromEntry(entry, dir, exit);
}

function stakePct(s: Signal): number {
  if (s.risk_percent != null && s.risk_percent > 0) return s.risk_percent;
  return DEFAULT_STAKE_PCT;
}

function leverage(s: Signal): number {
  const lev = s.leverage ?? 1;
  if (!Number.isFinite(lev) || lev < 1) return 1;
  return Math.min(Math.max(Math.trunc(lev), 1), MAX_LEVERAGE);
}

/** Баланс трекера для карточки: актуальный из ленты, иначе снимок при публикации. */
export function signalTrackerBalanceUsd(s: Signal, liveBalance?: number | null): number {
  if (liveBalance != null && liveBalance > 0) return liveBalance;
  if (s.tracker_balance != null && s.tracker_balance > 0) return s.tracker_balance;
  if (s.account_size != null && s.account_size > 0) return s.account_size;
  return 10_000;
}

/** База для номинала и P/L: баланс трекера на момент публикации, иначе размер счёта. */
export function signalPnlBaseUsd(s: Signal): number {
  if (s.tracker_balance != null && s.tracker_balance > 0) return s.tracker_balance;
  if (s.account_size != null && s.account_size > 0) return s.account_size;
  return 10_000;
}

function priceMoveAt(entry: number, direction: string, marketPrice: number): number {
  const dir = direction === "short" ? "short" : "long";
  return levelMovePctFromEntry(entry, dir, marketPrice);
}

function nominalUsd(s: Signal): number {
  return (signalPnlBaseUsd(s) * stakePct(s) * leverage(s)) / 100;
}

/** Нереализованный P/L по текущей рыночной цене (активный сигнал в сделке). */
export function signalUnrealizedPnl(s: Signal, marketPrice: number): number | null {
  if (s.status !== "active") return null;
  const entry = entryPrice(s);
  if (entry == null) return null;
  const move = priceMoveAt(entry, s.direction, marketPrice);
  return Math.round((nominalUsd(s) * move) / 100 * 100) / 100;
}

export function signalUnrealizedMovePct(s: Signal, marketPrice: number): number | null {
  if (s.status !== "active") return null;
  const entry = entryPrice(s);
  if (entry == null) return null;
  return priceMoveAt(entry, s.direction, marketPrice);
}

/** P/L в $: счёт × сумма входа % × плечо × движение цены / 100. */
export function signalRealizedPnl(s: Signal): number | null {
  if (s.status !== "win" && s.status !== "lose") return null;
  const move = priceMovePct(s);
  if (move == null) return s.realized_pnl;
  const base = signalPnlBaseUsd(s);
  const nominal = (base * stakePct(s) * leverage(s)) / 100;
  return Math.round((nominal * move) / 100 * 100) / 100;
}

export function signalEntryStakePct(s: Signal): number {
  return stakePct(s);
}

export function signalPriceMovePct(s: Signal): number | null {
  return priceMovePct(s);
}
