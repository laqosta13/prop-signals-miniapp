import { useEffect, useRef } from "react";

type Candle = { x: number; o: number; c: number; h: number; l: number };

const CANDLE_W = 5;
const CANDLE_GAP = 3;
const STEP = CANDLE_W + CANDLE_GAP;
const SPEED = 0.4;

function nextCandle(x: number, prev: Candle, H: number): Candle {
  const mid = H * 0.5;
  const range = H * 0.32;
  const prevMid = (prev.o + prev.c) / 2;
  const drift = (Math.random() - 0.49) * H * 0.12;
  const newMid = Math.min(Math.max(prevMid + drift, mid - range), mid + range);
  const bodyH = H * (0.06 + Math.random() * 0.18);
  const o = newMid - bodyH / 2;
  const c = newMid + bodyH / 2;
  const wickU = bodyH * (0.3 + Math.random() * 0.7);
  const wickD = bodyH * (0.3 + Math.random() * 0.7);
  return { x, o, c, h: Math.min(o, c) - wickU, l: Math.max(o, c) + wickD };
}

export function TopbarCandleBg() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;
    let offset = 0;
    const candles: Candle[] = [];

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);

      // seed candles to fill width
      candles.length = 0;
      let seed: Candle = { x: 0, o: h * 0.45, c: h * 0.55, h: h * 0.35, l: h * 0.65 };
      for (let x = -STEP; x < w + STEP * 2; x += STEP) {
        seed = nextCandle(x, seed, h);
        candles.push(seed);
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = () => {
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      ctx.clearRect(0, 0, W, H);

      offset += SPEED;
      if (offset >= STEP) {
        offset -= STEP;
        candles.shift();
        const last = candles[candles.length - 1];
        candles.push(nextCandle(last.x + STEP, last, H));
      }

      // recompute x positions
      candles.forEach((c, i) => { c.x = i * STEP - offset; });

      // draw candles
      candles.forEach((c) => {
        if (c.x < -STEP || c.x > W + STEP) return;
        const bull = c.c < c.o; // canvas y inverted: smaller y = higher price
        const bodyTop = Math.min(c.o, c.c);
        const bodyH = Math.abs(c.c - c.o);
        const cx = c.x + CANDLE_W / 2;

        const alpha = 0.22;
        const green = `rgba(61,255,138,${alpha})`;
        const red = `rgba(255,100,100,${alpha})`;
        const color = bull ? green : red;

        // wick
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 0.8;
        ctx.moveTo(cx, c.h);
        ctx.lineTo(cx, c.l);
        ctx.stroke();

        // body
        ctx.fillStyle = color;
        ctx.fillRect(c.x, bodyTop, CANDLE_W, Math.max(bodyH, 1.5));
      });

      // subtle chain dots along bottom edge
      const dotCount = Math.floor(W / 18);
      for (let i = 0; i <= dotCount; i++) {
        const x = (i / dotCount) * W;
        const phase = (x / W) * Math.PI * 6 + offset * 0.04;
        const y = H * 0.88 + Math.sin(phase) * H * 0.06;
        ctx.beginPath();
        ctx.arc(x, y, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(159,122,234,0.30)";
        ctx.fill();
        if (i > 0) {
          const xPrev = ((i - 1) / dotCount) * W;
          const phasePrev = (xPrev / W) * Math.PI * 6 + offset * 0.04;
          const yPrev = H * 0.88 + Math.sin(phasePrev) * H * 0.06;
          ctx.beginPath();
          ctx.moveTo(xPrev, yPrev);
          ctx.lineTo(x, y);
          ctx.strokeStyle = "rgba(159,122,234,0.14)";
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={ref} className="topbar-candle-bg" />;
}
