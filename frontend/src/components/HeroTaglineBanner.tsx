import { useEffect, useRef, useState } from "react";

/* ── mini SVG charts ────────────────────────────────────── */

function CandleChart() {
  return (
    <svg width="38" height="28" viewBox="0 0 38 28" fill="none" aria-hidden className="hero-banner__svg">
      {/* candles — low to high left→right */}
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
      {/* trend dashes */}
      <path d="M4 21 L10 17 L16 13 L22 9 L28 6 L34 3" strokeWidth="1" strokeDasharray="2 1.5" className="hb-trend"/>
    </svg>
  );
}

function CurveChart() {
  return (
    <svg width="38" height="28" viewBox="0 0 38 28" fill="none" aria-hidden className="hero-banner__svg">
      {/* area fill */}
      <path
        d="M1 26 C5 24 9 20 14 15 C19 10 24 7 38 3 L38 28 L1 28 Z"
        className="hb-area"
      />
      {/* line */}
      <path
        d="M1 26 C5 24 9 20 14 15 C19 10 24 7 38 3"
        strokeWidth="1.8" strokeLinecap="round" className="hb-line"
      />
      {/* end dot */}
      <circle cx="38" cy="3" r="2.2" className="hb-dot-end"/>
      {/* grid horizontal lines */}
      <line x1="0" y1="9"  x2="38" y2="9"  strokeWidth="0.5" className="hb-grid"/>
      <line x1="0" y1="18" x2="38" y2="18" strokeWidth="0.5" className="hb-grid"/>
    </svg>
  );
}

/* ── slides data ─────────────────────────────────────────── */

const SLIDES = [
  { chart: "candle", coin: "₿",  lead: "копирует все сделки",   accent: "ТОП ТРЕЙДЕРОВ"     },
  { chart: "curve",  coin: "Ξ",  lead: "AUTO COPY · BYBIT",     accent: "СИГНАЛЫ → СЧЁТ"    },
  { chart: "candle", coin: "₿Ξ", lead: "cult traders",          accent: "ТОРГУЮТ ЗА ТЕБЯ"   },
  { chart: "curve",  coin: "◈",  lead: "подключи API Bybit",    accent: "ТОРГУЙ С ТОПОМ"    },
] as const;

const DURATION = 3600;

export function HeroTaglineBanner() {
  const [idx, setIdx]       = useState(0);
  const [key, setKey]       = useState(0);
  const [prog, setProg]     = useState(0);
  const rafRef              = useRef<number>(0);
  const startRef            = useRef<number>(0);

  useEffect(() => {
    const tick = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = (ts - startRef.current) % DURATION;
      setProg(elapsed / DURATION);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    const iv = setInterval(() => {
      setIdx((i) => (i + 1) % SLIDES.length);
      setKey((k) => k + 1);
      startRef.current = 0;
    }, DURATION);

    return () => {
      clearInterval(iv);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const slide = SLIDES[idx];

  return (
    <div className="hero-banner">
      {/* sweep shimmer */}
      <span className="hero-banner__shimmer" aria-hidden />

      {/* left chart */}
      <span className="hero-banner__chart" aria-hidden>
        {slide.chart === "candle" ? <CandleChart /> : <CurveChart />}
      </span>

      {/* animated text block */}
      <span key={key} className="hero-banner__content">
        <span className="hero-banner__coin" aria-hidden>{slide.coin}</span>
        <span className="hero-banner__text">
          <span className="hero-banner__lead">{slide.lead}</span>
          <span className="hero-banner__accent">{slide.accent}</span>
        </span>
      </span>

      {/* progress bar + dots */}
      <span className="hero-banner__right" aria-hidden>
        <span className="hero-banner__dots">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className={`hero-banner__dot${i === idx ? " hero-banner__dot--on" : ""}`}
            />
          ))}
        </span>
        <span className="hero-banner__progress">
          <span className="hero-banner__progress-fill" style={{ transform: `scaleY(${prog})` }} />
        </span>
      </span>
    </div>
  );
}
