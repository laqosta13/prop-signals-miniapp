import { useEffect, useRef } from "react";

type Candle = { x: number; o: number; c: number; h: number; l: number; bull: boolean };

const CANDLE_W = 7;
const CANDLE_GAP = 3;
const STEP = CANDLE_W + CANDLE_GAP;
const SPEED = 0.35;
const MA_LEN = 8; // moving average window

function rnd(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function makeCandle(x: number, prevMid: number, H: number): Candle {
  const lo = H * 0.1;
  const hi = H * 0.9;
  const range = H * 0.28;
  const drift = (Math.random() - 0.48) * H * 0.14;
  const mid = Math.min(Math.max(prevMid + drift, H * 0.5 - range), H * 0.5 + range);
  const bodyH = H * rnd(0.10, 0.30);
  const bull = Math.random() > 0.45;
  const o = bull ? mid + bodyH / 2 : mid - bodyH / 2;
  const c = bull ? mid - bodyH / 2 : mid + bodyH / 2;
  const wickUp = bodyH * rnd(0.2, 1.1);
  const wickDn = bodyH * rnd(0.2, 1.1);
  return {
    x,
    o: Math.min(Math.max(o, lo), hi),
    c: Math.min(Math.max(c, lo), hi),
    h: Math.min(Math.min(o, c) - wickUp, lo + 2),
    l: Math.max(Math.max(o, c) + wickDn, hi - 2),
    bull,
  };
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

    const seed = () => {
      candles.length = 0;
      const H = canvas.offsetHeight;
      const W = canvas.offsetWidth;
      let prevMid = H * 0.5;
      for (let x = -STEP; x < W + STEP * 3; x += STEP) {
        const c = makeCandle(x, prevMid, H);
        prevMid = (c.o + c.c) / 2;
        candles.push(c);
      }
    };

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
      seed();
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
        const prevMid = (last.o + last.c) / 2;
        candles.push(makeCandle(last.x + STEP, prevMid, H));
      }

      // update x positions
      candles.forEach((c, i) => { c.x = i * STEP - offset; });

      // compute MA: rolling mean of midpoints of last MA_LEN visible candles
      const maPoints: { x: number; y: number }[] = [];
      const buf: number[] = [];
      candles.forEach((c) => {
        const mid = (c.o + c.c) / 2;
        buf.push(mid);
        if (buf.length > MA_LEN) buf.shift();
        const avg = buf.reduce((s, v) => s + v, 0) / buf.length;
        maPoints.push({ x: c.x + CANDLE_W / 2, y: avg });
      });

      // --- Draw candles ---
      candles.forEach((c) => {
        if (c.x < -STEP - 4 || c.x > W + 4) return;
        const cx = c.x + CANDLE_W / 2;
        const bodyTop = Math.min(c.o, c.c);
        const bodyH = Math.max(Math.abs(c.c - c.o), 1.5);
        const alpha = 0.50;
        const color = c.bull
          ? `rgba(52,211,138,${alpha})`
          : `rgba(248,80,80,${alpha})`;
        const wickColor = c.bull
          ? `rgba(52,211,138,${alpha * 0.75})`
          : `rgba(248,80,80,${alpha * 0.75})`;

        // wick
        ctx.beginPath();
        ctx.strokeStyle = wickColor;
        ctx.lineWidth = 1;
        ctx.moveTo(cx, c.h);
        ctx.lineTo(cx, c.l);
        ctx.stroke();

        // body
        ctx.fillStyle = color;
        ctx.fillRect(c.x, bodyTop, CANDLE_W, bodyH);

        // body border
        ctx.strokeStyle = c.bull ? `rgba(52,211,138,0.7)` : `rgba(248,80,80,0.7)`;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(c.x, bodyTop, CANDLE_W, bodyH);
      });

      // --- MA line (yellow, smooth) ---
      if (maPoints.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = "rgba(250,204,21,0.70)";
        ctx.lineWidth = 1.5;
        ctx.lineJoin = "round";
        maPoints.forEach((p, i) => {
          if (p.x < -STEP || p.x > W + STEP) return;
          if (i === 0 || maPoints[i - 1].x < -STEP) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();

        // MA glow
        ctx.beginPath();
        ctx.strokeStyle = "rgba(250,204,21,0.18)";
        ctx.lineWidth = 4;
        maPoints.forEach((p, i) => {
          if (p.x < -STEP || p.x > W + STEP) return;
          if (i === 0 || maPoints[i - 1].x < -STEP) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
      }

      // --- Entry / exit markers at MA reversals ---
      const vis = maPoints.filter((p) => p.x >= 0 && p.x <= W);
      for (let i = 2; i < vis.length - 2; i++) {
        const prev = vis[i - 1].y;
        const cur = vis[i].y;
        const next = vis[i + 1].y;
        const x = vis[i].x;
        const y = vis[i].y;

        // local bottom (price went down then up) → entry ▲
        if (cur > prev && cur > next) {
          ctx.beginPath();
          ctx.fillStyle = "rgba(52,211,138,0.90)";
          ctx.moveTo(x, y + 12);
          ctx.lineTo(x - 5, y + 4);
          ctx.lineTo(x + 5, y + 4);
          ctx.closePath();
          ctx.fill();
        }
        // local top → exit ▼
        if (cur < prev && cur < next) {
          ctx.beginPath();
          ctx.fillStyle = "rgba(248,80,80,0.90)";
          ctx.moveTo(x, y - 12);
          ctx.lineTo(x - 5, y - 4);
          ctx.lineTo(x + 5, y - 4);
          ctx.closePath();
          ctx.fill();
        }
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={ref} className="topbar-candle-bg" />;
}
