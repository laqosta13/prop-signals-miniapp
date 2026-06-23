import { useEffect, useRef, useState } from "react";

/* ── mini SVG charts ────────────────────────────────────── */

function CandleChart() {
  return (
    <svg width="38" height="28" viewBox="0 0 38 28" fill="none" aria-hidden className="hero-banner__svg">
      <line x1="4"  y1="22" x2="4"  y2="17" strokeWidth="1.2" className="hb-candle-wick"/>
      <rect x="2"  y="17" width="4" height="7"  rx="1" className="hb-candle-bear"/>
      <line x1="10" y1="20" x2="10" y2="14" strokeWidth="1.2" className="hb-candle-wick"/>
      <rect x="8"  y="14" width="4" height="7"  rx="1" className="hb-candle-bull"/>
      <line x1="10" y1="24" x2="10" y2="21" strokeWidth="1.2" className="hb-candle-wick"/>
      <line x1="16" y1="17" x2="16" y2="10" strokeWidth="1.2" className="hb-candle-wick"/>
      <rect x="14" y="10" width="4" height="8"  rx="1" className="hb-candle-bull"/>
      <line x1="22" y1="12" x2="22" y2="6"  strokeWidth="1.2" className="hb-candle-wick"/>
      <rect x="20" y="6"  width="4" height="8"  rx="1" className="hb-candle-bull"/>
      <line x1="28" y1="9"  x2="28" y2="3"  strokeWidth="1.2" className="hb-candle-wick"/>
      <rect x="26" y="3"  width="4" height="8"  rx="1" className="hb-candle-bull"/>
      <line x1="34" y1="6"  x2="34" y2="1"  strokeWidth="1.2" className="hb-candle-wick"/>
      <rect x="32" y="1"  width="4" height="7"  rx="1" className="hb-candle-bull hb-candle-bull--top"/>
      <path d="M4 21 L10 17 L16 13 L22 9 L28 6 L34 3" strokeWidth="1" strokeDasharray="2 1.5" className="hb-trend"/>
    </svg>
  );
}

function CurveChart() {
  return (
    <svg width="38" height="28" viewBox="0 0 38 28" fill="none" aria-hidden className="hero-banner__svg">
      <path d="M1 26 C5 24 9 20 14 15 C19 10 24 7 38 3 L38 28 L1 28 Z" className="hb-area"/>
      <path d="M1 26 C5 24 9 20 14 15 C19 10 24 7 38 3" strokeWidth="1.8" strokeLinecap="round" className="hb-line"/>
      <circle cx="38" cy="3" r="2.2" className="hb-dot-end"/>
      <line x1="0" y1="9"  x2="38" y2="9"  strokeWidth="0.5" className="hb-grid"/>
      <line x1="0" y1="18" x2="38" y2="18" strokeWidth="0.5" className="hb-grid"/>
    </svg>
  );
}

/* ── ticker content ──────────────────────────────────────── */

// строка-бегунок: все фразы в один поток
const TICKER_LEAD =
  "₿ копирует все сделки  ·  " +
  "Ξ AUTO COPY · BYBIT  ·  " +
  "₿Ξ cult traders  ·  " +
  "◈ подключи API Bybit  ·  ";

const TICKER_ACCENT =
  "ТОП ТРЕЙДЕРОВ  ◆  " +
  "СДЕЛКИ → СЧЁТ  ◆  " +
  "ТОРГУЮТ ЗА ТЕБЯ  ◆  " +
  "ТОРГУЙ С ТОПОМ  ◆  ";

/* ── chart cycle ─────────────────────────────────────────── */

const CHARTS = ["candle", "curve", "candle", "curve"] as const;
const CHART_INTERVAL = 3600;

export function HeroTaglineBanner() {
  const [chartIdx, setChartIdx] = useState(0);
  const [prog, setProg]         = useState(0);
  const rafRef                  = useRef<number>(0);
  const startRef                = useRef<number>(0);

  useEffect(() => {
    const tick = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = (ts - startRef.current) % CHART_INTERVAL;
      setProg(elapsed / CHART_INTERVAL);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    const iv = setInterval(() => {
      setChartIdx((i) => (i + 1) % CHARTS.length);
      startRef.current = 0;
    }, CHART_INTERVAL);

    return () => {
      clearInterval(iv);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="hero-banner">
      <span className="hero-banner__shimmer" aria-hidden />

      {/* cycling chart */}
      <span className="hero-banner__chart" aria-hidden>
        {CHARTS[chartIdx] === "candle" ? <CandleChart /> : <CurveChart />}
      </span>

      {/* running ticker */}
      <span className="hero-banner__ticker">
        {/* lead row */}
        <span className="hero-banner__ticker-row hero-banner__ticker-row--lead">
          <span className="hero-banner__ticker-inner">
            <span>{TICKER_LEAD}</span>
            <span aria-hidden>{TICKER_LEAD}</span>
          </span>
        </span>
        {/* accent row */}
        <span className="hero-banner__ticker-row hero-banner__ticker-row--accent">
          <span className="hero-banner__ticker-inner hero-banner__ticker-inner--rev">
            <span>{TICKER_ACCENT}</span>
            <span aria-hidden>{TICKER_ACCENT}</span>
          </span>
        </span>
      </span>

      {/* progress bar */}
      <span className="hero-banner__progress" aria-hidden>
        <span className="hero-banner__progress-fill" style={{ transform: `scaleY(${prog})` }} />
      </span>
    </div>
  );
}
