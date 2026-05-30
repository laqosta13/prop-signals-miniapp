import type { Signal } from "../api";
import { parseLevelPrice, parseTakeProfitPrices } from "./signalChartLevels";

const DEFAULT_STAKE_PCT = 10;
const MAX_LEVERAGE = 5;

function entryPrice(s: Signal): number | null {
  return parseLevelPrice(s.entry_low) ?? parseLevelPrice(s.entry_high) ?? s.published_market_price ?? null;
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
  if (s.direction === "short") {
    return Math.round(((entry - exit) / entry) * 10000) / 100;
  }
  return Math.round(((exit - entry) / entry) * 10000) / 100;
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

/** База для номинала: размер счёта (account_size), иначе баланс на момент публикации. */
export function signalPnlBaseUsd(s: Signal): number {
  if (s.account_size != null && s.account_size > 0) return s.account_size;
  if (s.tracker_balance != null && s.tracker_balance > 0) return s.tracker_balance;
  return 10_000;
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
