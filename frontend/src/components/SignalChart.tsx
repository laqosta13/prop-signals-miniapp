import { useEffect, useRef, useState } from "react";
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
  levelsFromSignal,
  resolveClosePrice,
  resolveCloseReason,
  tradingViewSymbol,
  type ChartCandle,
  type ChartInterval,
  type CloseReason,
} from "../utils/signalChartLevels";

const CHART_POLL_MS = 30_000;
const CHART_KLINE_LIMIT = 1000;
const CHART_VISIBLE_BARS = 180;
const CHART_HISTORY_BEFORE_MS = 36 * 60 * 60 * 1000;

type Props = {
  symbol: string;
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

function applyLevelLines(series: ISeriesApi<"Candlestick">, levels: ReturnType<typeof levelsFromSignal>) {
  const { stop, targets } = levels;

  if (stop != null) {
    series.createPriceLine({
      price: stop,
      color: "#ff6b6b",
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      axisLabelVisible: true,
      title: "Стоп",
    });
  }

  targets.forEach((tp, i) => {
    series.createPriceLine({
      price: tp,
      color: "#e0afff",
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      axisLabelVisible: true,
      title: targets.length > 1 ? `Цель ${i + 1}` : "Цель",
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
  entryPrice: number | null | undefined,
  closeTime: UTCTimestamp | null,
  closeLabel: string | null,
  closeColor: string,
  closePrice: number | null,
): SeriesMarker<UTCTimestamp>[] {
  const markers: SeriesMarker<UTCTimestamp>[] = [];
  if (entryTime != null) {
    markers.push({
      time: entryTime,
      position: "inBar",
      color: "#3dff8a",
      shape: "circle",
      text: entryPrice != null ? `Вход ${entryPrice.toFixed(2)}` : "Вход",
    });
  }
  if (closeTime != null) {
    const priceHint = closePrice != null ? ` · ${closePrice.toFixed(2)}` : "";
    const text = closeLabel ? `${closeLabel}${priceHint}` : `Закрыт${priceHint}`;
    markers.push({
      time: closeTime,
      position: "inBar",
      color: closeColor,
      shape: "circle",
      text,
    });
  }
  return markers.sort((a, b) => Number(a.time) - Number(b.time));
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
    return;
  }

  const half = Math.floor(CHART_VISIBLE_BARS / 2);
  let from = focusIdx - half;
  let to = from + CHART_VISIBLE_BARS;
  if (from < 0) {
    from = 0;
    to = CHART_VISIBLE_BARS;
  }
  if (to > candles.length) {
    to = candles.length;
    from = Math.max(0, to - CHART_VISIBLE_BARS);
  }

  chart.timeScale().setVisibleLogicalRange({ from, to });
}

export function SignalChart({
  symbol,
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
  const pinnedEntryRef = useRef<{ fillAt: string; time: UTCTimestamp } | null>(null);
  const pinnedCloseRef = useRef<{ closedAt: string; time: UTCTimestamp } | null>(null);
  const loadedRef = useRef(false);
  const [interval, setInterval] = useState<ChartInterval>("5");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [entryLineLeft, setEntryLineLeft] = useState<number | null>(null);
  const [closeLineLeft, setCloseLineLeft] = useState<number | null>(null);
  const [closeOverlay, setCloseOverlay] = useState<{ label: string; reason: CloseReason } | null>(null);

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
  ) => {
    const entryTime = resolvePinnedEntryTime(candles, candleSec);
    entryCandleTimeRef.current = entryTime;

    const reason =
      frozen && closedAt ? resolveCloseReason(closeReason, status, closedExitPrice, levels) : null;
    const label = closeReasonLabel(reason);
    const closeTime = frozen && closedAt ? resolvePinnedCloseTime(candles, candleSec) : null;
    closeCandleTimeRef.current = closeTime;

    if (reason && label) {
      setCloseOverlay({ label, reason });
    } else if (frozen && closedAt) {
      setCloseOverlay({ label: label ?? "Закрыт", reason: reason ?? "market" });
    } else {
      setCloseOverlay(null);
    }

    const closePrice = resolveClosePrice(levels, reason, closedExitPrice);
    series.setMarkers(
      buildChartMarkers(entryTime, entryPrice, closeTime, label, closeReasonColor(reason), closePrice),
    );
  };

  const syncOverlayLines = (chart: IChartApi) => {
    setEntryLineLeft(syncLineLeft(chart, entryCandleTimeRef.current));
    setCloseLineLeft(syncLineLeft(chart, closeCandleTimeRef.current));
  };

  useEffect(() => {
    loadedRef.current = false;
    entryCandleTimeRef.current = null;
    closeCandleTimeRef.current = null;
    pinnedEntryRef.current = null;
    pinnedCloseRef.current = null;
    setEntryLineLeft(null);
    setCloseLineLeft(null);
    setCloseOverlay(null);
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

    const chart = createChart(chartRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#141416" },
        textColor: "#8a8a93",
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      width: chartRef.current.clientWidth,
      height: 240,
    });
    chartApi.current = chart;
    const updateOverlayLines = () => syncOverlayLines(chart);
    chart.timeScale().subscribeVisibleTimeRangeChange(updateOverlayLines);
    const ro = new ResizeObserver(() => {
      if (chartRef.current) {
        chart.applyOptions({ width: chartRef.current.clientWidth });
        updateOverlayLines();
      }
    });
    ro.observe(chartRef.current);

    return () => {
      chart.timeScale().unsubscribeVisibleTimeRangeChange(updateOverlayLines);
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
      loadedRef.current = false;
    };
  }, [visible]);

  useEffect(() => {
    if (!visible || !pair || !chartApi.current) return;

    const bybitIv = CHART_INTERVALS.find((x) => x.id === interval)?.bybit ?? "5";
    const ac = new AbortController();
    setLoading(true);
    setErr(null);
    const lv = levelsFromSignal(entryLow, entryHigh, stopLoss, takeProfits);
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
        const series = chart.addCandlestickSeries({
          upColor: "#3dff8a",
          downColor: "#ff6b6b",
          borderVisible: false,
          wickUpColor: "#3dff8a",
          wickDownColor: "#ff6b6b",
        });
        seriesRef.current = series;
        series.setData(data);
        applyLevelLines(series, lv);
        paintChartMarkers(series, data, candleSec, lv);
        applyFeedVisibleRange(chart, data, entryCandleTimeRef.current, closeCandleTimeRef.current, createdAt);
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
  ]);

  useEffect(() => {
    if (!visible || !pair || frozen || !entryFilledAt) return;

    const bybitIv = CHART_INTERVALS.find((x) => x.id === interval)?.bybit ?? "5";
    const candleSec = Math.max(60, Number(bybitIv) * 60);
    const lv = levelsFromSignal(entryLow, entryHigh, stopLoss, takeProfits);

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
          paintChartMarkers(seriesNow, data, candleSec, lv);
          applyFeedVisibleRange(
            chartNow,
            data,
            entryCandleTimeRef.current,
            closeCandleTimeRef.current,
            createdAt,
          );
          syncOverlayLines(chartNow);
        })
        .catch(() => {
          /* keep last frame */
        });
    };

    const id = window.setInterval(refreshCandles, CHART_POLL_MS);
    return () => window.clearInterval(id);
  }, [visible, pair, interval, frozen, entryFilledAt, entryPrice, entryLow, entryHigh, stopLoss, takeProfits, createdAt, closedAt]);

  if (!pair) return null;

  return (
    <section ref={wrapRef} className={`signal-chart${frozen ? " signal-chart--frozen" : ""}`}>
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
        {entryLineLeft != null && entryFilledAt && (
          <>
            <div className="signal-chart__marker-line signal-chart__marker-line--entry" style={{ left: `${entryLineLeft}px` }} />
            <div className="signal-chart__marker-badge signal-chart__marker-badge--entry" style={{ left: `${entryLineLeft}px` }}>
              Вход
            </div>
          </>
        )}
        {closeLineLeft != null && closeOverlay && (
          <>
            <div
              className={`signal-chart__marker-line signal-chart__marker-line--${closeOverlay.reason}`}
              style={{ left: `${closeLineLeft}px` }}
            />
            <div
              className={`signal-chart__marker-badge signal-chart__marker-badge--${closeOverlay.reason}`}
              style={{ left: `${closeLineLeft}px` }}
            >
              {closeOverlay.label}
            </div>
          </>
        )}
      </div>
      <div className="signal-chart__legend">
        <span className="signal-chart__legend-item entry">Вход</span>
        <span className="signal-chart__legend-item stop">Стоп</span>
        <span className="signal-chart__legend-item target">Цель</span>
        {closeOverlay && (
          <span className={`signal-chart__legend-item close close--${closeOverlay.reason}`}>{closeOverlay.label}</span>
        )}
      </div>
    </section>
  );
}
