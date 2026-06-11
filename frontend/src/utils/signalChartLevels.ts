/** Парсинг уровней сигнала для графика. */

import { parseApiDate } from "../utils";
import type { AutoscaleInfo, UTCTimestamp } from "lightweight-charts";
import { roundPct } from "./formatPct";

export type ChartCandle = {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

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

/**
 * Референс входа для % и P/L — как backend `effective_entry_price`:
 * лимитная зона (entry_low/high) важнее снимка рынка при публикации.
 */
export function chartEntryReference(
  levels: SignalChartLevels,
  publishedMarketPrice?: number | null,
): number | null {
  const low = levels.entryLow;
  const high = levels.entryHigh;
  if (low != null && high != null) return (low + high) / 2;
  if (low != null || high != null) return low ?? high ?? null;
  if (
    publishedMarketPrice != null &&
    Number.isFinite(publishedMarketPrice) &&
    publishedMarketPrice > 0
  ) {
    return publishedMarketPrice;
  }
  return null;
}

/** % движения цены от входа с учётом направления (+ в сторону профита). */
export function levelMovePctFromEntry(
  entry: number,
  direction: "long" | "short",
  levelPrice: number,
): number {
  if (entry <= 0 || !Number.isFinite(levelPrice)) return 0;
  const raw =
    direction === "short"
      ? ((entry - levelPrice) / entry) * 100
      : ((levelPrice - entry) / entry) * 100;
  return roundPct(raw);
}

export function formatSignedMovePct(pct: number): string {
  const sign = pct >= 0 ? "+" : "−";
  const abs = Math.abs(pct);
  const text = abs >= 10 ? abs.toFixed(2) : abs >= 1 ? abs.toFixed(2) : abs.toFixed(3);
  const trimmed = text.replace(/\.?0+$/, "");
  return `${sign}${trimmed}%`;
}

export function chartLevelLineTitle(
  baseLabel: string,
  entry: number | null,
  direction: "long" | "short",
  levelPrice: number,
): string {
  if (entry == null || entry <= 0) return baseLabel;
  const pct = levelMovePctFromEntry(entry, direction, levelPrice);
  return `${baseLabel} ${formatSignedMovePct(pct)}`;
}

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

/** Все уровни сигнала для расчёта шкалы цены (вход, стоп, цели, выход). */
export function chartLevelPrices(
  levels: SignalChartLevels,
  extras?: { entryPrice?: number | null; closedExitPrice?: number | null },
): number[] {
  const out: number[] = [];
  if (levels.entryLow != null) out.push(levels.entryLow);
  if (levels.entryHigh != null && levels.entryHigh !== levels.entryLow) out.push(levels.entryHigh);
  if (levels.stop != null) out.push(levels.stop);
  out.push(...levels.targets);
  const ep = extras?.entryPrice;
  if (ep != null && Number.isFinite(ep) && ep > 0) out.push(ep);
  const xp = extras?.closedExitPrice;
  if (xp != null && Number.isFinite(xp) && xp > 0) out.push(xp);
  return out;
}

/** Точность подписей на оси цены — без усечения значимых цифр. */
export function chartPriceFormatOptions(prices: number[]): {
  type: "price";
  precision: number;
  minMove: number;
} {
  const ref = prices.length ? Math.max(...prices.map((p) => Math.abs(p))) : 1;
  if (ref >= 10_000) return { type: "price", precision: 2, minMove: 0.01 };
  if (ref >= 1000) return { type: "price", precision: 2, minMove: 0.01 };
  if (ref >= 100) return { type: "price", precision: 3, minMove: 0.001 };
  if (ref >= 1) return { type: "price", precision: 4, minMove: 0.0001 };
  if (ref >= 0.01) return { type: "price", precision: 5, minMove: 0.00001 };
  return { type: "price", precision: 6, minMove: 0.000001 };
}

/** Шкала включает свечи и уровни сигнала — стоп/цель не обрезаются. */
export function createLevelAutoscaleProvider(extraPrices: number[]) {
  const valid = extraPrices.filter((p) => Number.isFinite(p) && p > 0);
  return (base: () => AutoscaleInfo | null): AutoscaleInfo | null => {
    const info = base();
    if (!valid.length) return info;

    let min = info?.priceRange?.minValue ?? Infinity;
    let max = info?.priceRange?.maxValue ?? -Infinity;
    if (!info) {
      min = Math.min(...valid);
      max = Math.max(...valid);
    } else {
      for (const p of valid) {
        min = Math.min(min, p);
        max = Math.max(max, p);
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return info;

    const span = max - min;
    const pad = span > 0 ? span * 0.04 : Math.max(max * 0.02, 0.0001);
    return {
      priceRange: {
        minValue: min - pad,
        maxValue: max + pad,
      },
      margins: info?.margins ?? { above: 0.12, below: 0.12 },
    };
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

function pricesNear(a: number, b: number, tolerancePct = 0.12): boolean {
  return (Math.abs(a - b) / Math.max(Math.abs(b), 1e-12)) * 100 <= tolerancePct;
}

export function resolveCloseReason(
  closeReason: string | null | undefined,
  status: string,
  closedExitPrice?: number | null,
  levels?: Pick<SignalChartLevels, "stop" | "targets">,
): CloseReason | null {
  if (closeReason === "market") return "market";

  if (closedExitPrice != null && levels && (status === "win" || status === "lose")) {
    const { stop, targets } = levels;
    if (stop != null && pricesNear(closedExitPrice, stop)) return "stop";
    if (targets.some((tp) => pricesNear(closedExitPrice, tp))) return "target";
    if (status === "win" || status === "lose") return "market";
  }

  if (closeReason === "stop" || closeReason === "target") return closeReason;
  if (status === "win") return "target";
  if (status === "lose") return "stop";
  return null;
}

/** Цена закрытия на графике: стоп/цель — ровно по уровню, рынок — фактическая. */
export function chartCloseExitPrice(
  levels: Pick<SignalChartLevels, "stop" | "targets">,
  reason: CloseReason | null,
  direction: "long" | "short",
  closedExitPrice?: number | null,
): number | null {
  if (reason === "stop" && levels.stop != null) return levels.stop;
  if (reason === "target" && levels.targets.length) {
    return direction === "short" ? Math.max(...levels.targets) : Math.min(...levels.targets);
  }
  if (closedExitPrice != null && Number.isFinite(closedExitPrice)) return closedExitPrice;
  return null;
}

export function closeReasonLabel(reason: CloseReason | null): string | null {
  if (reason === "stop") return "SL";
  if (reason === "target") return "TP";
  if (reason === "market") return "По рынку";
  return null;
}

export function closeReasonColor(reason: CloseReason | null): string {
  if (reason === "stop") return "#ff6b6b";
  if (reason === "target") return "#e0afff";
  if (reason === "market") return "#ffd166";
  return "#aab4c7";
}

export type SignalOutcomeDisplay = {
  label: string;
  className: "win" | "lose" | "market" | "active" | "waiting" | "active-in";
};

/** Подпись и стиль бейджа исхода в карточке сигнала. */
export function signalOutcomeDisplay(
  status: string,
  entryDone: boolean,
  closeReason: string | null | undefined,
  closedExitPrice: number | null | undefined,
  entryLow: string | null,
  entryHigh: string | null,
  stopLoss: string | null,
  takeProfits: string | null,
): SignalOutcomeDisplay {
  if (status === "win" || status === "lose") {
    const levels = levelsFromSignal(entryLow, entryHigh, stopLoss, takeProfits);
    const reason = resolveCloseReason(closeReason, status, closedExitPrice, levels);
    const label = closeReasonLabel(reason);
    if (reason === "market") {
      const moveClass = status === "win" ? "win" : status === "lose" ? "lose" : "market";
      return { label: label ?? "По рынку", className: moveClass };
    }
    if (reason === "target") return { label: label ?? "Цель достигнута", className: "win" };
    return { label: label ?? "Стоп", className: "lose" };
  }
  if (!entryDone) return { label: "Ожидание входа", className: "waiting" };
  if (status === "active") return { label: "Активен", className: "active-in" };
  return { label: "Активен", className: "active" };
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
