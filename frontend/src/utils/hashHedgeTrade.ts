import type { Signal } from "../api";
import { formatTakeProfits } from "../utils";
import { signalEntryStakePct } from "./signalPnl";
import { chartEntryReference, levelsFromSignal } from "./signalChartLevels";

export type HashHedgeTradeSignal = Pick<
  Signal,
  | "id"
  | "number"
  | "symbol"
  | "direction"
  | "status"
  | "entry_low"
  | "entry_high"
  | "stop_loss"
  | "take_profits"
  | "leverage"
  | "risk_percent"
  | "published_market_price"
  | "entry_filled_at"
>;

export function hedgePerpSymbol(symbol: string): string {
  const s = symbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!s) return "BTCUSDT";
  if (s.endsWith("USDT")) return s;
  if (s.endsWith("USD") && s.length > 3) return `${s.slice(0, -3)}USDT`;
  return `${s}USDT`;
}

function formatEntryLine(signal: HashHedgeTradeSignal): string {
  const hasZone = !!(signal.entry_low?.trim() || signal.entry_high?.trim());
  if (!hasZone || signal.entry_filled_at) return "Рынок";
  const lv = levelsFromSignal(signal.entry_low, signal.entry_high, signal.stop_loss, signal.take_profits);
  const ref = chartEntryReference(lv, signal.published_market_price);
  if (ref != null && Number.isFinite(ref)) return String(ref);
  return signal.entry_low || signal.entry_high || "Рынок";
}

/** Текст для буфера — удобно вставлять стоп/TP в форму Hedge. */
export function formatHashHedgeTradeClipboard(signal: HashHedgeTradeSignal): string {
  const num = signal.number ?? signal.id;
  const pair = hedgePerpSymbol(signal.symbol);
  const side = signal.direction === "long" ? "LONG (Покупка / Лонг)" : "SHORT (Продажа / Шорт)";
  const lev = Math.max(1, signal.leverage ?? 1);
  const stake = signalEntryStakePct(signal);
  const stop = signal.stop_loss?.trim() || "—";
  const tp = formatTakeProfits(signal.take_profits) || "—";
  const entry = formatEntryLine(signal);

  return [
    `HASH HEDGE · сигнал #${num}`,
    `Пара: ${pair} Perpetual`,
    `Направление: ${side}`,
    `Плечо: ${lev}x`,
    `Доля входа (ориентир): ${stake}%`,
    `Вход: ${entry}`,
    "",
    "— уровни для TP/SL —",
    `Стоп-лосс: ${stop}`,
    `Тейк-профит: ${tp}`,
    "",
    "Шаги:",
    "1. Торговать → Ордер",
    "2. Рынок · изолированная маржа · плечо как в сигнале",
    "3. Включить TP/SL · вставить стоп и цель",
    "4. Подтвердить Long или Short",
  ].join("\n");
}

