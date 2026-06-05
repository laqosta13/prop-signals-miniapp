import { useCallback, useEffect, useRef, useState } from "react";
import {
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type SeriesMarker,
  type UTCTimestamp,
} from "lightweight-charts";
import { parseApiDate } from "../utils";
import {
  CHART_INTERVALS,
  bybitSymbol,
  candleTimeForInstant,
  closeReasonColor,
  closeReasonLabel,
  entryCandleTimeForFill,
  chartCloseExitPrice,
  chartEntryReference,
  chartLevelLineTitle,
  chartLevelPrices,
  chartPriceFormatOptions,
  createLevelAutoscaleProvider,
  formatSignedMovePct,
  levelMovePctFromEntry,
  levelsFromSignal,
  resolveCloseReason,
  tradingViewSymbol,
  type ChartCandle,
  type ChartInterval,
  type CloseReason,
} from "../utils/signalChartLevels";
import { fetchBybitLastPrice } from "../utils/bybitPrice";
import { chartPaletteFor, type ChartPalette } from "../utils/chartTheme";
import { getStoredTheme, subscribeTheme, type Theme } from "../utils/theme";

const CHART_POLL_MS = 30_000;
const CHART_LIVE_PRICE_MS = 10_000;
const CHART_PNL_PARTICLE_MS = 850;
const CHART_KLINE_LIMIT = 1000;
const CHART_VISIBLE_BARS = 220;
/** Плашки в одной колонке, если линии входа и закрытия близко (быстрое закрытие). */
const MARKER_BADGE_CLUSTER_PX = 100;
const CHART_HISTORY_BEFORE_MS = 36 * 60 * 60 * 1000;
const CHART_RIGHT_OFFSET_BARS = 24;

type Props = {
  symbol: string;
  direction?: "long" | "short";
  createdAt?: string | null;
  entryLow: string | null;
  entryHigh: string | null;
  stopLoss: string | null;
  takeProfits: string | null;
  closedAt?: string | null;
  closeReason?: string | null;
  closedExitPrice?: number | null;
  status?: string;
  entryFilledAt?: string | null;
  entryPrice?: number | null;
  /** win/lose — один раз загрузить свечи и не обновлять */
  frozen?: boolean;
};

async function fetchBybitKlines(
  pair: string,
  interval: string,
  options?: { endMs?: number; limit?: number },
): Promise<ChartCandle[]> {
  const params = new URLSearchParams({
    category: "linear",
    symbol: pair,
    interval,
    limit: String(options?.limit ?? CHART_KLINE_LIMIT),
  });
  const endMs = options?.endMs;
  if (endMs != null && Number.isFinite(endMs)) {
    params.set("end", String(Math.ceil(endMs)));
  }
  const res = await fetch(`https://api.bybit.com/v5/market/kline?${params}`);
  if (!res.ok) throw new Error("Не удалось загрузить свечи");
  const body = (await res.json()) as { retCode?: number; result?: { list?: string[][] } };
  if (body.retCode !== 0) throw new Error("Bybit: нет данных по паре");
  const rows = body.result?.list ?? [];
  const candles = rows
    .map((k) => ({
      time: Math.floor(Number(k[0]) / 1000) as UTCTimestamp,
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
    }))
    .filter((c) => Number.isFinite(c.close));
  candles.reverse();
  return candles;
}

const ENTRY_ZONE_PRICE_EPS = 1e-8;

type LiveTrailSide = "up" | "down" | "flat";

type LiveTrail = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  side: LiveTrailSide;
  closeReason: CloseReason | null;
};

type PnlParticle = {
  id: number;
  sign: "+" | "-";
  drift: number;
};

function isLivePriceInProfit(
  direction: "long" | "short",
  entryRef: number,
  livePrice: number,
): boolean | null {
  const eps = Math.max(entryRef * 1e-8, 1e-12);
  if (Math.abs(livePrice - entryRef) <= eps) return null;
  return direction === "long" ? livePrice > entryRef : livePrice < entryRef;
}

function resolveLiveTimeX(
  chart: IChartApi,
  entryTime: UTCTimestamp,
  lastCandleTime: UTCTimestamp | null,
): number | null {
  const nowSec = Math.floor(Date.now() / 1000) as UTCTimestamp;
  const times: UTCTimestamp[] = [nowSec];
  if (lastCandleTime != null) times.push(lastCandleTime);
  times.push(entryTime);
  for (const t of times) {
    const x = chart.timeScale().timeToCoordinate(t);
    if (x != null && Number.isFinite(x)) return x;
  }
  const w = chart.timeScale().width();
  return w != null && Number.isFinite(w) ? Math.max(0, w - 6) : null;
}

type LevelLineOpts = {
  direction: "long" | "short";
  entryRef: number | null;
  awaitingEntry?: boolean;
  palette: ChartPalette;
};

function addAwaitingEntryPriceLines(
  series: ISeriesApi<"Candlestick">,
  levels: ReturnType<typeof levelsFromSignal>,
  palette: ChartPalette,
) {
  const low = levels.entryLow;
  const high = levels.entryHigh;
  const prices: number[] = [];
  if (
    low != null &&
    high != null &&
    Math.abs(low - high) > ENTRY_ZONE_PRICE_EPS
  ) {
    prices.push(low, high);
  } else {
    const single = low ?? high;
    if (single != null) prices.push(single);
  }
  for (const price of prices) {
    series.createPriceLine({
      price,
      color: palette.entryWaiting,
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      axisLabelColor: palette.entryWaiting,
      title: "Лимитка",
    });
  }
}

function applyLevelLines(
  series: ISeriesApi<"Candlestick">,
  levels: ReturnType<typeof levelsFromSignal>,
  opts: LevelLineOpts,
) {
  const { stop, targets } = levels;
  const dir = opts.direction;

  if (opts.awaitingEntry) {
    addAwaitingEntryPriceLines(series, levels, opts.palette);
  }

  if (stop != null) {
    series.createPriceLine({
      price: stop,
      color: opts.palette.stop,
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      axisLabelVisible: true,
      title: chartLevelLineTitle("Стоп", opts.entryRef, dir, stop),
    });
  }

  targets.forEach((tp, i) => {
    const base = targets.length > 1 ? `Цель ${i + 1}` : "Цель";
    series.createPriceLine({
      price: tp,
      color: opts.palette.target,
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      axisLabelVisible: true,
      title: chartLevelLineTitle(base, opts.entryRef, dir, tp),
    });
  });
}

function clipCandlesAtClose(candles: ChartCandle[], closedAt: string | null | undefined, candleSec: number): ChartCandle[] {
  if (!closedAt || !candles.length) return candles;
  const closeMs = parseApiDate(closedAt).getTime();
  if (!Number.isFinite(closeMs)) return candles;
  const closeSec = Math.floor(closeMs / 1000);
  for (let i = 0; i < candles.length; i += 1) {
    const t = Number(candles[i].time);
    if (closeSec >= t && closeSec < t + candleSec) {
      return candles.slice(0, i + 1);
    }
  }
  const lastT = Number(candles[candles.length - 1].time);
  if (closeSec >= lastT) {
    return candles;
  }
  return candles.slice(0, 1);
}

function clipCandlesForSignal(
  candles: ChartCandle[],
  createdAt: string | null | undefined,
  closedAt: string | null | undefined,
  candleSec: number,
  isFrozen: boolean,
): ChartCandle[] {
  let data = isFrozen ? clipCandlesAtClose(candles, closedAt, candleSec) : candles;
  if (!createdAt || !data.length) return data;
  const minStartMs = parseApiDate(createdAt).getTime() - CHART_HISTORY_BEFORE_MS;
  if (!Number.isFinite(minStartMs)) return data;
  const minStartSec = Math.floor(minStartMs / 1000);
  const idx = data.findIndex((c) => Number(c.time) >= minStartSec);
  if (idx > 0) return data.slice(idx);
  return data;
}

function buildChartMarkers(
  entryTime: UTCTimestamp | null,
  closeTime: UTCTimestamp | null,
  closeColor: string,
  showEntryMarker = true,
  showCloseMarker = true,
): SeriesMarker<UTCTimestamp>[] {
  const markers: SeriesMarker<UTCTimestamp>[] = [];
  if (showEntryMarker && entryTime != null) {
    markers.push({
      time: entryTime,
      position: "inBar",
      color: "#3dff8a",
      shape: "circle",
    });
  }
  if (showCloseMarker && closeTime != null) {
    markers.push({
      time: closeTime,
      position: "inBar",
      color: closeColor,
      shape: "circle",
    });
  }
  return markers.sort((a, b) => Number(a.time) - Number(b.time));
}

function closedTrailSide(
  reason: CloseReason | null,
  signalStatus: string,
): LiveTrailSide {
  if (reason === "target" || signalStatus === "win") return "up";
  if (reason === "stop" || signalStatus === "lose") return "down";
  return "flat";
}

function trailEndClass(trail: LiveTrail, frozen: boolean): string {
  if (frozen && trail.closeReason) return trail.closeReason;
  return trail.side;
}

function syncLineLeft(chart: IChartApi, time: UTCTimestamp | null): number | null {
  if (time == null) return null;
  const x = chart.timeScale().timeToCoordinate(time);
  return x != null && Number.isFinite(x) ? x : null;
}

function candleIndexForTime(candles: ChartCandle[], time: UTCTimestamp | null): number | null {
  if (time == null || !candles.length) return null;
  const exact = candles.findIndex((c) => c.time === time);
  if (exact >= 0) return exact;
  const t = Number(time);
  for (let i = candles.length - 1; i >= 0; i -= 1) {
    if (Number(candles[i].time) <= t) return i;
  }
  return 0;
}

/** На ленте показываем 180 свечей, центрируя вход и закрытие (не прижимая к правому краю). */
function applyFeedVisibleRange(
  chart: IChartApi,
  candles: ChartCandle[],
  entryTime: UTCTimestamp | null,
  closeTime: UTCTimestamp | null,
  createdAt: string | null | undefined,
) {
  if (!candles.length) return;

  const entryIdx = candleIndexForTime(candles, entryTime);
  const closeIdx = candleIndexForTime(candles, closeTime);

  let focusIdx: number;
  if (entryIdx != null && closeIdx != null) {
    focusIdx = Math.round((entryIdx + closeIdx) / 2);
  } else if (entryIdx != null) {
    focusIdx = entryIdx;
  } else if (closeIdx != null) {
    focusIdx = closeIdx;
  } else if (createdAt) {
    const createdSec = Math.floor(parseApiDate(createdAt).getTime() / 1000);
    const idx = candles.findIndex((c) => Number(c.time) >= createdSec);
    focusIdx = idx >= 0 ? idx : candles.length - 1;
  } else {
    focusIdx = candles.length - 1;
  }

  if (candles.length <= CHART_VISIBLE_BARS) {
    chart.timeScale().fitContent();
    chart.timeScale().applyOptions({ rightOffset: CHART_RIGHT_OFFSET_BARS });
    return;
  }

  const half = Math.floor(CHART_VISIBLE_BARS / 2);
  let from = focusIdx - half;
  let to = from + CHART_VISIBLE_BARS - CHART_RIGHT_OFFSET_BARS;
  if (from < 0) {
    from = 0;
    to = Math.min(candles.length, CHART_VISIBLE_BARS - CHART_RIGHT_OFFSET_BARS);
  }
  if (to > candles.length) {
    to = candles.length;
    from = Math.max(0, to - (CHART_VISIBLE_BARS - CHART_RIGHT_OFFSET_BARS));
  }

  chart.timeScale().setVisibleLogicalRange({ from, to });
  chart.timeScale().applyOptions({ rightOffset: CHART_RIGHT_OFFSET_BARS });
}

function closeBadgeLabel(
  reason: CloseReason | null,
  base: string | null,
  entryRef: number | null,
  direction: "long" | "short",
  exitPrice: number | null,
): string {
  const name = base ?? "Закрыт";
  if (entryRef == null || exitPrice == null || !Number.isFinite(exitPrice)) return name;
  const pct = levelMovePctFromEntry(entryRef, direction, exitPrice);
  return `${name} ${formatSignedMovePct(pct)}`;
}

export function SignalChart({
  symbol,
  direction = "long",
  createdAt,
  entryLow,
  entryHigh,
  stopLoss,
  takeProfits,
  closedAt,
  closeReason,
  closedExitPrice,
  status = "active",
  entryFilledAt,
  entryPrice,
  frozen = false,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const chartApi = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const entryCandleTimeRef = useRef<UTCTimestamp | null>(null);
  const closeCandleTimeRef = useRef<UTCTimestamp | null>(null);
  const lastCandleTimeRef = useRef<UTCTimestamp | null>(null);
  const entryRefPriceRef = useRef<number | null>(null);
  const closeExitPriceRef = useRef<number | null>(null);
  const closeReasonRef = useRef<CloseReason | null>(null);
  const pinnedEntryRef = useRef<{ fillAt: string; time: UTCTimestamp } | null>(null);
  const pinnedCloseRef = useRef<{ closedAt: string; time: UTCTimestamp } | null>(null);
  const loadedRef = useRef(false);
  const livePriceRef = useRef<number | null>(null);
  const syncOverlayLinesRef = useRef<(chart: IChartApi) => void>(() => {});
  const [interval, setInterval] = useState<ChartInterval>("1");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [entryLineLeft, setEntryLineLeft] = useState<number | null>(null);
  const [closeLineLeft, setCloseLineLeft] = useState<number | null>(null);
  const [closeOverlay, setCloseOverlay] = useState<{ label: string; reason: CloseReason } | null>(null);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [liveTrail, setLiveTrail] = useState<LiveTrail | null>(null);
  const [pnlParticles, setPnlParticles] = useState<PnlParticle[]>([]);
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme());
  const palette = chartPaletteFor(theme);
  const isLiveEntryTrail = !frozen && status === "active" && !!entryFilledAt;
  const showEntryTrail = !!entryFilledAt && (isLiveEntryTrail || (frozen && !!closedAt));

  useEffect(() => subscribeTheme(() => setTheme(getStoredTheme())), []);

  useEffect(() => {
    livePriceRef.current = livePrice;
  }, [livePrice]);

  const pair = bybitSymbol(symbol);
  const tvLink = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tradingViewSymbol(symbol))}`;

  const resolvePinnedEntryTime = (candles: ChartCandle[], candleSec: number): UTCTimestamp | null => {
    if (!entryFilledAt || !candles.length) return null;
    if (pinnedEntryRef.current?.fillAt === entryFilledAt) {
      return pinnedEntryRef.current.time;
    }
    const time = entryCandleTimeForFill(candles, entryFilledAt, candleSec);
    if (time != null) pinnedEntryRef.current = { fillAt: entryFilledAt, time };
    return time;
  };

  const resolvePinnedCloseTime = (candles: ChartCandle[], candleSec: number): UTCTimestamp | null => {
    if (!closedAt || !candles.length) return null;
    if (pinnedCloseRef.current?.closedAt === closedAt) {
      return pinnedCloseRef.current.time;
    }
    const time = candleTimeForInstant(candles, closedAt, candleSec);
    if (time != null) pinnedCloseRef.current = { closedAt, time };
    return time;
  };

  const paintChartMarkers = (
    series: ISeriesApi<"Candlestick">,
    candles: ChartCandle[],
    candleSec: number,
    levels: ReturnType<typeof levelsFromSignal>,
    entryRef: number | null,
  ) => {
    const entryTime = resolvePinnedEntryTime(candles, candleSec);
    entryCandleTimeRef.current = entryTime;

    const reason =
      frozen && closedAt ? resolveCloseReason(closeReason, status, closedExitPrice, levels) : null;
    const label = closeReasonLabel(reason);
    const closeTime = frozen && closedAt ? resolvePinnedCloseTime(candles, candleSec) : null;
    closeCandleTimeRef.current = closeTime;
    const exitPx = chartCloseExitPrice(levels, reason, direction, closedExitPrice);
    closeExitPriceRef.current = exitPx;
    closeReasonRef.current = reason;

    if (reason && label) {
      setCloseOverlay({
        label: closeBadgeLabel(reason, label, entryRef, direction, exitPx),
        reason,
      });
    } else if (frozen && closedAt) {
      setCloseOverlay({
        label: closeBadgeLabel(reason ?? "market", label ?? "Закрыт", entryRef, direction, exitPx),
        reason: reason ?? "market",
      });
    } else {
      setCloseOverlay(null);
    }

    const showEntryMarker = !entryFilledAt;
    const showCloseMarker = !(frozen && exitPx != null);
    series.setMarkers(
      buildChartMarkers(
        entryTime,
        closeTime,
        closeReasonColor(reason),
        showEntryMarker,
        showCloseMarker,
      ),
    );
  };

  const syncEntryTrail = useCallback(
    (price: number | null) => {
      if (!showEntryTrail) {
        setLiveTrail(null);
        return;
      }
      const chart = chartApi.current;
      const series = seriesRef.current;
      const entryTime = entryCandleTimeRef.current;
      const entryRef = entryRefPriceRef.current;
      if (!chart || !series || entryTime == null || entryRef == null) {
        setLiveTrail(null);
        return;
      }

      let x2: number | null;
      let endPrice: number | null;
      let side: LiveTrailSide;
      let trailCloseReason: CloseReason | null = null;

      if (frozen && closedAt) {
        const closeTime = closeCandleTimeRef.current;
        endPrice = closeExitPriceRef.current;
        trailCloseReason = closeReasonRef.current;
        if (closeTime == null || endPrice == null) {
          setLiveTrail(null);
          return;
        }
        x2 = chart.timeScale().timeToCoordinate(closeTime);
        side = closedTrailSide(trailCloseReason, status);
      } else {
        if (price == null) {
          setLiveTrail(null);
          return;
        }
        x2 = resolveLiveTimeX(chart, entryTime, lastCandleTimeRef.current);
        endPrice = price;
        const profit = isLivePriceInProfit(direction, entryRef, price);
        side = profit == null ? "flat" : profit ? "up" : "down";
      }

      const x1 = chart.timeScale().timeToCoordinate(entryTime);
      const y1 = series.priceToCoordinate(entryRef);
      const y2 = series.priceToCoordinate(endPrice);
      if (
        x1 == null ||
        y1 == null ||
        x2 == null ||
        y2 == null ||
        !Number.isFinite(x1) ||
        !Number.isFinite(y1) ||
        !Number.isFinite(x2) ||
        !Number.isFinite(y2)
      ) {
        setLiveTrail(null);
        return;
      }
      setLiveTrail({ x1, y1, x2, y2, side, closeReason: trailCloseReason });
    },
    [direction, showEntryTrail, frozen, closedAt, status],
  );

  const syncOverlayLines = useCallback(
    (chart: IChartApi) => {
      setEntryLineLeft(syncLineLeft(chart, entryCandleTimeRef.current));
      setCloseLineLeft(syncLineLeft(chart, closeCandleTimeRef.current));
      syncEntryTrail(livePriceRef.current);
    },
    [syncEntryTrail],
  );

  useEffect(() => {
    syncOverlayLinesRef.current = syncOverlayLines;
  }, [syncOverlayLines]);

  useEffect(() => {
    loadedRef.current = false;
    entryCandleTimeRef.current = null;
    closeCandleTimeRef.current = null;
    pinnedEntryRef.current = null;
    pinnedCloseRef.current = null;
    setEntryLineLeft(null);
    setCloseLineLeft(null);
    setCloseOverlay(null);
    setLivePrice(null);
    setLiveTrail(null);
    setPnlParticles([]);
    lastCandleTimeRef.current = null;
    entryRefPriceRef.current = null;
    closeExitPriceRef.current = null;
    closeReasonRef.current = null;
  }, [symbol, frozen, interval, entryFilledAt, createdAt, closedAt, closeReason, closedExitPrice, status]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setVisible(entry?.isIntersecting ?? false),
      { threshold: 0.15, rootMargin: "80px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !chartRef.current) return;

    const colors = chartPaletteFor(theme);
    const chart = createChart(chartRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: colors.background },
        textColor: colors.text,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        borderVisible: false,
        autoScale: true,
        entireTextOnly: false,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: CHART_RIGHT_OFFSET_BARS,
      },
      width: chartRef.current.clientWidth,
      height: 268,
    });
    chartApi.current = chart;
    const updateOverlayLines = () => syncOverlayLinesRef.current(chart);
    chart.timeScale().subscribeVisibleTimeRangeChange(updateOverlayLines);
    chart.timeScale().subscribeVisibleLogicalRangeChange(updateOverlayLines);
    const ro = new ResizeObserver(() => {
      if (chartRef.current) {
        chart.applyOptions({ width: chartRef.current.clientWidth });
        updateOverlayLines();
      }
    });
    ro.observe(chartRef.current);

    return () => {
      chart.timeScale().unsubscribeVisibleTimeRangeChange(updateOverlayLines);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(updateOverlayLines);
      ro.disconnect();
      chart.remove();
      chartApi.current = null;
      seriesRef.current = null;
      entryCandleTimeRef.current = null;
      closeCandleTimeRef.current = null;
      pinnedEntryRef.current = null;
      pinnedCloseRef.current = null;
      setEntryLineLeft(null);
      setCloseLineLeft(null);
      setCloseOverlay(null);
      setLivePrice(null);
      setLiveTrail(null);
      setPnlParticles([]);
      loadedRef.current = false;
    };
  }, [visible, theme]);

  useEffect(() => {
    if (!visible || !pair || !chartApi.current) return;

    const bybitIv = CHART_INTERVALS.find((x) => x.id === interval)?.bybit ?? "1";
    const ac = new AbortController();
    setLoading(true);
    setErr(null);
    const lv = levelsFromSignal(entryLow, entryHigh, stopLoss, takeProfits);
    const entryRef = chartEntryReference(lv, entryPrice);
    const awaitingEntry =
      !entryFilledAt && (lv.entryLow != null || lv.entryHigh != null);
    const candleSec = Math.max(60, Number(bybitIv) * 60);
    const closeEndMs =
      frozen && closedAt
        ? parseApiDate(closedAt).getTime() + candleSec * 1000
        : undefined;

    void fetchBybitKlines(pair, bybitIv, { endMs: closeEndMs, limit: CHART_KLINE_LIMIT })
      .then((candles) => {
        if (ac.signal.aborted) return;
        const chart = chartApi.current;
        if (!chart) return;
        const data = clipCandlesForSignal(candles, createdAt, closedAt, candleSec, frozen);
        if (seriesRef.current) chart.removeSeries(seriesRef.current);
        const scalePrices = chartLevelPrices(lv, { entryPrice: entryRef, closedExitPrice });
        const series = chart.addCandlestickSeries({
          upColor: palette.upColor,
          downColor: palette.downColor,
          borderVisible: false,
          wickUpColor: palette.wickUp,
          wickDownColor: palette.wickDown,
          priceFormat: chartPriceFormatOptions(scalePrices),
          autoscaleInfoProvider: createLevelAutoscaleProvider(scalePrices),
        });
        seriesRef.current = series;
        series.setData(data);
        entryRefPriceRef.current = entryRef;
        lastCandleTimeRef.current = data.length ? data[data.length - 1].time : null;
        applyLevelLines(series, lv, { direction, entryRef, awaitingEntry, palette });
        paintChartMarkers(series, data, candleSec, lv, entryRef);
        applyFeedVisibleRange(chart, data, entryCandleTimeRef.current, closeCandleTimeRef.current, createdAt);
        series.priceScale().applyOptions({ autoScale: true });
        chart.priceScale("right").applyOptions({ autoScale: true });
        if (isLiveEntryTrail && data.length) {
          const lastClose = data[data.length - 1].close;
          setLivePrice(lastClose);
          syncEntryTrail(lastClose);
        } else if (showEntryTrail) {
          syncEntryTrail(null);
        }
        syncOverlayLines(chart);
        loadedRef.current = true;
      })
      .catch((e) => {
        entryCandleTimeRef.current = null;
        closeCandleTimeRef.current = null;
        setEntryLineLeft(null);
        setCloseLineLeft(null);
        setCloseOverlay(null);
        if (!ac.signal.aborted) setErr(e instanceof Error ? e.message : "Ошибка графика");
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });

    return () => ac.abort();
  }, [
    visible,
    pair,
    interval,
    entryLow,
    entryHigh,
    stopLoss,
    takeProfits,
    closedAt,
    createdAt,
    closeReason,
    closedExitPrice,
    status,
    entryFilledAt,
    entryPrice,
    frozen,
    theme,
    palette.upColor,
    palette.downColor,
  ]);

  useEffect(() => {
    if (!visible || !pair || frozen || !entryFilledAt) return;

    const bybitIv = CHART_INTERVALS.find((x) => x.id === interval)?.bybit ?? "1";
    const candleSec = Math.max(60, Number(bybitIv) * 60);
    const lv = levelsFromSignal(entryLow, entryHigh, stopLoss, takeProfits);
    const entryRef = chartEntryReference(lv, entryPrice);

    const refreshCandles = () => {
      const chart = chartApi.current;
      const series = seriesRef.current;
      if (!chart || !series || !loadedRef.current) return;

      void fetchBybitKlines(pair, bybitIv, { limit: CHART_KLINE_LIMIT })
        .then((candles) => {
          const chartNow = chartApi.current;
          const seriesNow = seriesRef.current;
          if (!chartNow || !seriesNow) return;
          const data = clipCandlesForSignal(candles, createdAt, closedAt, candleSec, false);
          seriesNow.setData(data);
          lastCandleTimeRef.current = data.length ? data[data.length - 1].time : null;
          paintChartMarkers(seriesNow, data, candleSec, lv, entryRef);
          applyFeedVisibleRange(
            chartNow,
            data,
            entryCandleTimeRef.current,
            closeCandleTimeRef.current,
            createdAt,
          );
          seriesNow.priceScale().applyOptions({ autoScale: true });
          chartNow.priceScale("right").applyOptions({ autoScale: true });
          if (data.length) {
            const price = livePriceRef.current ?? data[data.length - 1].close;
            setLivePrice(price);
            syncEntryTrail(price);
          }
          syncOverlayLines(chartNow);
        })
        .catch(() => {
          /* keep last frame */
        });
    };

    const id = window.setInterval(refreshCandles, CHART_POLL_MS);
    return () => window.clearInterval(id);
  }, [visible, pair, interval, frozen, entryFilledAt, entryPrice, entryLow, entryHigh, stopLoss, takeProfits, createdAt, closedAt]);

  useEffect(() => {
    if (!visible || !pair || !isLiveEntryTrail) {
      if (!showEntryTrail) {
        setLiveTrail(null);
      }
      setLivePrice(null);
      setPnlParticles([]);
      return;
    }

    let cancelled = false;

    const tick = async () => {
      const price = await fetchBybitLastPrice(symbol);
      if (cancelled) return;
      const next = price ?? livePriceRef.current;
      if (next == null) return;
      setLivePrice(next);
      syncEntryTrail(next);
    };

    void tick();
    const id = window.setInterval(() => void tick(), CHART_LIVE_PRICE_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [visible, pair, symbol, isLiveEntryTrail, showEntryTrail, syncEntryTrail]);

  useEffect(() => {
    if (!visible || !showEntryTrail) return;
    let raf = 0;
    const tick = () => {
      const chart = chartApi.current;
      if (chart) syncOverlayLinesRef.current(chart);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible, showEntryTrail]);

  useEffect(() => {
    if (!isLiveEntryTrail || !liveTrail || liveTrail.side === "flat") return;
    const sign: "+" | "-" = liveTrail.side === "up" ? "+" : "-";
    const id = window.setInterval(() => {
      const now = Date.now();
      setPnlParticles((prev) => {
        const fresh = prev.filter((p) => now - p.id < 1_500);
        return [
          ...fresh.slice(-5),
          { id: now, sign, drift: (Math.random() - 0.5) * 24 },
        ];
      });
    }, CHART_PNL_PARTICLE_MS);
    return () => window.clearInterval(id);
  }, [isLiveEntryTrail, liveTrail?.side]);

  if (!pair) return null;

  const lvLegend = levelsFromSignal(entryLow, entryHigh, stopLoss, takeProfits);
  const awaitingEntryLegend =
    !entryFilledAt && (lvLegend.entryLow != null || lvLegend.entryHigh != null);

  const markerBadgeCluster =
    entryLineLeft != null &&
    closeLineLeft != null &&
    entryFilledAt &&
    closeOverlay != null &&
    Math.abs(entryLineLeft - closeLineLeft) < MARKER_BADGE_CLUSTER_PX;
  const markerClusterLeft =
    markerBadgeCluster && entryLineLeft != null && closeLineLeft != null
      ? (entryLineLeft + closeLineLeft) / 2
      : null;

  const chartEntryRef = chartEntryReference(lvLegend, entryPrice);
  const trailEndBadgeLabel =
    frozen && closeOverlay
      ? closeOverlay.label
      : livePrice != null && chartEntryRef != null
        ? formatSignedMovePct(levelMovePctFromEntry(chartEntryRef, direction, livePrice))
        : null;

  return (
    <section
      ref={wrapRef}
      className={`signal-chart${frozen ? " signal-chart--frozen" : ""}${
        awaitingEntryLegend ? " signal-chart--awaiting-entry" : ""
      }`}
    >
      <div className="signal-chart__head">
        {!frozen && (
          <div className="signal-chart__tf">
            {CHART_INTERVALS.map((tf) => (
              <button
                key={tf.id}
                type="button"
                className={interval === tf.id ? "on" : ""}
                onClick={() => setInterval(tf.id)}
              >
                {tf.label}
              </button>
            ))}
          </div>
        )}
        <a className="signal-chart__tv-link" href={tvLink} target="_blank" rel="noreferrer">
          TradingView ↗
        </a>
      </div>
      <div className="signal-chart__body">
        {loading && <p className="signal-chart__loading meta">Загрузка графика…</p>}
        {err && <p className="signal-chart__err err">{err}</p>}
        <div ref={chartRef} className="signal-chart__canvas" />
        {liveTrail && (
          <svg className="signal-chart__live-svg" aria-hidden>
            <line
              className={`signal-chart__live-line signal-chart__live-line--${trailEndClass(liveTrail, frozen)}`}
              x1={liveTrail.x1}
              y1={liveTrail.y1}
              x2={liveTrail.x2}
              y2={liveTrail.y2}
            />
          </svg>
        )}
        {liveTrail && (
          <div
            className="signal-chart__trail-badge signal-chart__trail-badge--entry signal-chart__marker-badge--entry"
            style={{ left: `${liveTrail.x1}px`, top: `${liveTrail.y1}px` }}
          >
            Вход
          </div>
        )}
        {liveTrail && trailEndBadgeLabel && (
          <div
            className={`signal-chart__trail-badge signal-chart__trail-badge--end signal-chart__marker-badge--${trailEndClass(
              liveTrail,
              frozen,
            )}`}
            style={{ left: `${liveTrail.x2}px`, top: `${liveTrail.y2}px` }}
          >
            {trailEndBadgeLabel}
          </div>
        )}
        {isLiveEntryTrail &&
          liveTrail &&
          pnlParticles.map((particle) => (
            <span
              key={particle.id}
              className={`signal-chart__pnl-particle signal-chart__pnl-particle--${
                particle.sign === "+" ? "up" : "down"
              }`}
              style={{
                left: `${liveTrail.x2 + particle.drift}px`,
                top: `${liveTrail.y2}px`,
              }}
            >
              {particle.sign}$
            </span>
          ))}
        {entryLineLeft != null && entryFilledAt && (
          <div
            className="signal-chart__marker-line signal-chart__marker-line--entry"
            style={{ left: `${entryLineLeft}px` }}
          />
        )}
        {closeLineLeft != null && closeOverlay && (
          <div
            className={`signal-chart__marker-line signal-chart__marker-line--${closeOverlay.reason}`}
            style={{ left: `${closeLineLeft}px` }}
          />
        )}
        {markerBadgeCluster && markerClusterLeft != null && closeOverlay && (
          <div
            className="signal-chart__marker-cluster"
            style={{ left: `${markerClusterLeft}px` }}
          >
            <div className="signal-chart__marker-badge signal-chart__marker-badge--entry">Вход</div>
            <div
              className={`signal-chart__marker-badge signal-chart__marker-badge--${closeOverlay.reason}`}
            >
              {closeOverlay.label}
            </div>
          </div>
        )}
        {!markerBadgeCluster && entryLineLeft != null && entryFilledAt && !liveTrail && (
          <div
            className="signal-chart__marker-badge signal-chart__marker-badge--entry"
            style={{ left: `${entryLineLeft}px` }}
          >
            Вход
          </div>
        )}
        {!markerBadgeCluster && closeLineLeft != null && closeOverlay && !liveTrail && (
          <div
            className={`signal-chart__marker-badge signal-chart__marker-badge--${closeOverlay.reason}`}
            style={{ left: `${closeLineLeft}px` }}
          >
            {closeOverlay.label}
          </div>
        )}
      </div>
      <div className="signal-chart__legend">
        <span className="signal-chart__legend-item entry">
          {awaitingEntryLegend ? "Лимитка" : "Вход"}
        </span>
        <span className="signal-chart__legend-item stop">Стоп</span>
        <span className="signal-chart__legend-item target">Цель</span>
        {closeOverlay && (
          <span className={`signal-chart__legend-item close close--${closeOverlay.reason}`}>{closeOverlay.label}</span>
        )}
      </div>
    </section>
  );
}
