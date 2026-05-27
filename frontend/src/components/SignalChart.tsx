import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import {
  CHART_INTERVALS,
  binanceSymbol,
  levelsFromSignal,
  tradingViewSymbol,
  type ChartInterval,
} from "../utils/signalChartLevels";

type Candle = { time: UTCTimestamp; open: number; high: number; low: number; close: number };

type Props = {
  symbol: string;
  entryLow: string | null;
  entryHigh: string | null;
  stopLoss: string | null;
  takeProfits: string | null;
};

async function fetchBinanceKlines(pair: string, interval: string): Promise<Candle[]> {
  const url = `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${interval}&limit=180`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Не удалось загрузить свечи");
  const raw = (await res.json()) as unknown[][];
  return raw.map((k) => ({
    time: Math.floor(Number(k[0]) / 1000) as UTCTimestamp,
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
  }));
}

function applyLevelLines(series: ISeriesApi<"Candlestick">, levels: ReturnType<typeof levelsFromSignal>) {
  const { entryLow, entryHigh, stop, targets } = levels;

  if (entryLow != null && entryHigh != null && Math.abs(entryHigh - entryLow) > 1e-12) {
    series.createPriceLine({
      price: entryLow,
      color: "rgba(61, 255, 138, 0.95)",
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: "Вход",
    });
    series.createPriceLine({
      price: entryHigh,
      color: "rgba(61, 255, 138, 0.55)",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false,
      title: "",
    });
  } else {
    const entry = entryLow ?? entryHigh;
    if (entry != null) {
      series.createPriceLine({
        price: entry,
        color: "#3dff8a",
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: "Вход",
      });
    }
  }

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

export function SignalChart({ symbol, entryLow, entryHigh, stopLoss, takeProfits }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const chartApi = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [interval, setInterval] = useState<ChartInterval>("5");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  const pair = binanceSymbol(symbol);
  const tvLink = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tradingViewSymbol(symbol))}`;

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
        background: { type: ColorType.Solid, color: "#0c0c12" },
        textColor: "#9ca3af",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.08)" },
      timeScale: { borderColor: "rgba(255,255,255,0.08)", timeVisible: true, secondsVisible: false },
      width: chartRef.current.clientWidth,
      height: 240,
    });
    chartApi.current = chart;
    const ro = new ResizeObserver(() => {
      if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth });
    });
    ro.observe(chartRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartApi.current = null;
      seriesRef.current = null;
    };
  }, [visible]);

  useEffect(() => {
    if (!visible || !pair || !chartApi.current) return;
    const binanceIv = CHART_INTERVALS.find((x) => x.id === interval)?.binance ?? "5m";
    const ac = new AbortController();
    setLoading(true);
    setErr(null);
    const lv = levelsFromSignal(entryLow, entryHigh, stopLoss, takeProfits);

    void fetchBinanceKlines(pair, binanceIv)
      .then((candles) => {
        if (ac.signal.aborted) return;
        const chart = chartApi.current;
        if (!chart) return;
        if (seriesRef.current) chart.removeSeries(seriesRef.current);
        const series = chart.addSeries(CandlestickSeries, {
          upColor: "#3dff8a",
          downColor: "#ff6b6b",
          borderVisible: false,
          wickUpColor: "#3dff8a",
          wickDownColor: "#ff6b6b",
        });
        seriesRef.current = series;
        series.setData(candles);
        applyLevelLines(series, lv);
        chart.timeScale().fitContent();
      })
      .catch((e) => {
        if (!ac.signal.aborted) setErr(e instanceof Error ? e.message : "Ошибка графика");
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });

    return () => ac.abort();
  }, [visible, pair, interval, entryLow, entryHigh, stopLoss, takeProfits]);

  if (!pair) return null;

  return (
    <section ref={wrapRef} className="signal-chart">
      <div className="signal-chart__head">
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
        <a className="signal-chart__tv-link" href={tvLink} target="_blank" rel="noreferrer">
          TradingView ↗
        </a>
      </div>
      <div className="signal-chart__body">
        {loading && <p className="signal-chart__loading meta">Загрузка графика…</p>}
        {err && <p className="signal-chart__err err">{err}</p>}
        <div ref={chartRef} className="signal-chart__canvas" />
      </div>
      <div className="signal-chart__legend">
        <span className="signal-chart__legend-item entry">Вход</span>
        <span className="signal-chart__legend-item stop">Стоп</span>
        <span className="signal-chart__legend-item target">Цель</span>
      </div>
    </section>
  );
}
