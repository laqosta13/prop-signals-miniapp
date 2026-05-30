/** Парсинг уровней сигнала для графика. */

import { parseApiDate } from "../utils";
import type { UTCTimestamp } from "lightweight-charts";

export type ChartCandle = { time: UTCTimestamp; open: number; high: number; low: number; close: number };

export function parseLevelPrice(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(",", ".").replace(/[^\d.\-]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function parseTakeProfitPrices(raw: string | null | undefined): number[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    try {
      const arr = JSON.parse(trimmed) as unknown;
      if (Array.isArray(arr)) {
        return arr
          .map((x) => parseLevelPrice(String(x)))
          .filter((p): p is number => p != null);
      }
    } catch {
      /* */
    }
  }
  return trimmed
    .split(/[,;]+/)
    .map((p) => parseLevelPrice(p))
    .filter((p): p is number => p != null);
}

/** Символ пары USDT perpetual на Bybit (linear). */
export function bybitSymbol(symbol: string): string | null {
  const s = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!s) return null;
  if (s.endsWith("USDT")) return s;
  if (s.endsWith("USD") && s.length > 3) return `${s.slice(0, -3)}USDT`;
  return `${s}USDT`;
}

export function tradingViewSymbol(symbol: string): string {
  const pair = bybitSymbol(symbol);
  if (!pair) return "BYBIT:BTCUSDT";
  return `BYBIT:${pair}`;
}

export type ChartInterval = "1" | "5" | "15";

export const CHART_INTERVALS: { id: ChartInterval; label: string; bybit: string }[] = [
  { id: "1", label: "1м", bybit: "1" },
  { id: "5", label: "5м", bybit: "5" },
  { id: "15", label: "15м", bybit: "15" },
];

export type SignalChartLevels = {
  entryLow: number | null;
  entryHigh: number | null;
  stop: number | null;
  targets: number[];
};

export function levelsFromSignal(
  entryLow: string | null,
  entryHigh: string | null,
  stopLoss: string | null,
  takeProfits: string | null,
): SignalChartLevels {
  const low = parseLevelPrice(entryLow);
  const high = parseLevelPrice(entryHigh);
  return {
    entryLow: low,
    entryHigh: high ?? low,
    stop: parseLevelPrice(stopLoss),
    targets: parseTakeProfitPrices(takeProfits),
  };
}

/** Свеча для момента времени (вход, закрытие). */
export function candleTimeForInstant(
  candles: ChartCandle[],
  instantIso: string,
  candleSec: number,
): UTCTimestamp | null {
  return entryCandleTimeForFill(candles, instantIso, candleSec);
}

export type CloseReason = "stop" | "target" | "market";

export function resolveCloseReason(
  closeReason: string | null | undefined,
  status: string,
): CloseReason | null {
  if (closeReason === "stop" || closeReason === "target" || closeReason === "market") {
    return closeReason;
  }
  if (status === "win") return "target";
  if (status === "lose") return "stop";
  return null;
}

export function closeReasonLabel(reason: CloseReason | null): string | null {
  if (reason === "stop") return "Стоп";
  if (reason === "target") return "Цель";
  if (reason === "market") return "По рынку";
  return null;
}

export function closeReasonColor(reason: CloseReason | null): string {
  if (reason === "stop") return "#ff6b6b";
  if (reason === "target") return "#e0afff";
  if (reason === "market") return "#ffd166";
  return "#aab4c7";
}

export function resolveClosePrice(
  levels: SignalChartLevels,
  reason: CloseReason | null,
  closedExitPrice: number | null | undefined,
): number | null {
  if (closedExitPrice != null && Number.isFinite(closedExitPrice)) return closedExitPrice;
  if (reason === "stop") return levels.stop;
  if (reason === "target") return levels.targets[0] ?? null;
  return null;
}

/** Свеча, на которой зафиксирован вход (по времени entry_filled_at). */
export function entryCandleTimeForFill(
  candles: ChartCandle[],
  entryFilledAt: string,
  candleSec: number,
): UTCTimestamp | null {
  if (!candles.length) return null;
  const fillMs = parseApiDate(entryFilledAt).getTime();
  if (!Number.isFinite(fillMs)) return null;
  const fillSec = Math.floor(fillMs / 1000);
  for (let i = candles.length - 1; i >= 0; i -= 1) {
    const t = Number(candles[i].time);
    if (fillSec >= t && fillSec < t + candleSec) return candles[i].time;
  }
  const lastT = Number(candles[candles.length - 1].time);
  if (fillSec >= lastT) return candles[candles.length - 1].time;
  return candles[0].time;
}
