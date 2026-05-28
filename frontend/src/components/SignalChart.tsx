import { useEffect, useRef, useState } from "react";
import {
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { parseApiDate } from "../utils";
import {
  CHART_INTERVALS,
  bybitSymbol,
  entryCandleTimeForFill,
  levelsFromSignal,
  tradingViewSymbol,
  type ChartCandle,
  type ChartInterval,
} from "../utils/signalChartLevels";

const CHART_POLL_MS = 30_000;

type Props = {
  symbol: string;
  entryLow: string | null;
  entryHigh: string | null;
  stopLoss: string | null;
  takeProfits: string | null;
  closedAt?: string | null;
  entryFilledAt?: string | null;
  entryPrice?: number | null;
  /** win/lose — один раз загрузить свечи и не обновлять */
  frozen?: boolean;
};

async function fetchBybitKlines(pair: string, interval: string): Promise<ChartCandle[]> {
  const params = new URLSearchParams({
    category: "linear",
    symbol: pair,
    interval,
    limit: "180",
  });
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
  return candles;
}

function applyEntryMarkerAtTime(
  series: ISeriesApi<"Candlestick">,
  time: UTCTimestamp,
  entryPrice?: number | null,
) {
  const label = entryPrice != null ? `Вход ${entryPrice.toFixed(2)}` : "Вход";
  series.setMarkers([
    {
      time,
      position: "inBar",
      color: "#3dff8a",
      shape: "circle",
      text: label,
    },
  ]);
}

function syncEntryLineLeft(chart: IChartApi, time: UTCTimestamp | null): number | null {
  if (time == null) return null;
  const x = chart.timeScale().timeToCoordinate(time);
  return x != null && Number.isFinite(x) ? x : null;
}

export function SignalChart({
  symbol,
  entryLow,
  entryHigh,
  stopLoss,
  takeProfits,
  closedAt,
  entryFilledAt,
  entryPrice,
  frozen = false,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const chartApi = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const entryCandleTimeRef = useRef<UTCTimestamp | null>(null);
  const pinnedEntryRef = useRef<{ fillAt: string; time: UTCTimestamp } | null>(null);
  const loadedRef = useRef(false);
  const [interval, setInterval] = useState<ChartInterval>("5");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [entryLineLeft, setEntryLineLeft] = useState<number | null>(null);

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

  const paintEntryMarker = (series: ISeriesApi<"Candlestick">, candles: ChartCandle[], candleSec: number) => {
    const time = resolvePinnedEntryTime(candles, candleSec);
    entryCandleTimeRef.current = time;
    if (time == null) {
      series.setMarkers([]);
      return;
    }
    applyEntryMarkerAtTime(series, time, entryPrice);
  };

  useEffect(() => {
    loadedRef.current = false;
    entryCandleTimeRef.current = null;
    pinnedEntryRef.current = null;
    setEntryLineLeft(null);
  }, [symbol, frozen, interval, entryFilledAt, closedAt]);

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
    const updateEntryLinePosition = () => {
      setEntryLineLeft(syncEntryLineLeft(chart, entryCandleTimeRef.current));
    };
    chart.timeScale().subscribeVisibleTimeRangeChange(updateEntryLinePosition);
    const ro = new ResizeObserver(() => {
      if (chartRef.current) {
        chart.applyOptions({ width: chartRef.current.clientWidth });
        updateEntryLinePosition();
      }
    });
    ro.observe(chartRef.current);

    return () => {
      chart.timeScale().unsubscribeVisibleTimeRangeChange(updateEntryLinePosition);
      ro.disconnect();
      chart.remove();
      chartApi.current = null;
      seriesRef.current = null;
      entryCandleTimeRef.current = null;
      pinnedEntryRef.current = null;
      setEntryLineLeft(null);
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

    void fetchBybitKlines(pair, bybitIv)
      .then((candles) => {
        if (ac.signal.aborted) return;
        const chart = chartApi.current;
        if (!chart) return;
        const candleSec = Math.max(60, Number(bybitIv) * 60);
        const data = frozen ? clipCandlesAtClose(candles, closedAt, candleSec) : candles;
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
        paintEntryMarker(series, data, candleSec);
        chart.timeScale().fitContent();
        setEntryLineLeft(syncEntryLineLeft(chart, entryCandleTimeRef.current));
        loadedRef.current = true;
      })
      .catch((e) => {
        entryCandleTimeRef.current = null;
        setEntryLineLeft(null);
        if (!ac.signal.aborted) setErr(e instanceof Error ? e.message : "Ошибка графика");
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });

    return () => ac.abort();
  }, [visible, pair, interval, entryLow, entryHigh, stopLoss, takeProfits, closedAt, entryFilledAt, entryPrice, frozen]);

  useEffect(() => {
    if (!visible || !pair || frozen || !entryFilledAt) return;

    const bybitIv = CHART_INTERVALS.find((x) => x.id === interval)?.bybit ?? "5";
    const candleSec = Math.max(60, Number(bybitIv) * 60);

    const refreshCandles = () => {
      const chart = chartApi.current;
      const series = seriesRef.current;
      if (!chart || !series || !loadedRef.current) return;

      void fetchBybitKlines(pair, bybitIv)
        .then((candles) => {
          const chartNow = chartApi.current;
          const seriesNow = seriesRef.current;
          if (!chartNow || !seriesNow) return;
          seriesNow.setData(candles);
          paintEntryMarker(seriesNow, candles, candleSec);
          setEntryLineLeft(syncEntryLineLeft(chartNow, entryCandleTimeRef.current));
        })
        .catch(() => {
          /* keep last frame */
        });
    };

    const id = window.setInterval(refreshCandles, CHART_POLL_MS);
    return () => window.clearInterval(id);
  }, [visible, pair, interval, frozen, entryFilledAt, entryPrice]);

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
        {entryLineLeft != null && <div className="signal-chart__entry-line" style={{ left: `${entryLineLeft}px` }} />}
      </div>
      <div className="signal-chart__legend">
        <span className="signal-chart__legend-item entry">Вход</span>
        <span className="signal-chart__legend-item stop">Стоп</span>
        <span className="signal-chart__legend-item target">Цель</span>
      </div>
    </section>
  );
}
