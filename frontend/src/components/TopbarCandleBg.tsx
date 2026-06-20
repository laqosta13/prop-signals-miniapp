import { useEffect, useRef } from "react";

type Candle = { x: number; o: number; c: number; h: number; l: number; bull: boolean };
type Node   = { x: number; y: number; vx: number; vy: number };

const CW   = 7;   // candle body width
const GAP  = 4;   // gap between candles
const STEP = CW + GAP;
const SPD  = 0.38;
const MA_N = 9;

function rnd(a: number, b: number) { return a + Math.random() * (b - a); }

function makeCandle(x: number, prevMid: number, H: number): Candle {
  const drift  = (Math.random() - 0.48) * H * 0.12;
  const mid    = Math.min(Math.max(prevMid + drift, H * 0.30), H * 0.70);
  const bodyH  = H * rnd(0.08, 0.22);
  const bull   = Math.random() > 0.44;
  const top    = mid - bodyH / 2;
  const bot    = mid + bodyH / 2;
  const wickUp = bodyH * rnd(0.4, 1.0);
  const wickDn = bodyH * rnd(0.4, 1.0);
  return {
    x,
    o: bull ? bot : top,
    c: bull ? top : bot,
    h: top - wickUp,
    l: bot + wickDn,
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

    // blockchain nodes
    const nodes: Node[] = Array.from({ length: 7 }, () => ({
      x: 0, y: 0,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.25,
    }));

    const initNodes = (W: number, H: number) => {
      nodes.forEach((n, i) => {
        n.x = (i / (nodes.length - 1)) * W;
        n.y = H * 0.65 + Math.random() * H * 0.25;
      });
    };

    const seed = (W: number, H: number) => {
      candles.length = 0;
      let prevMid = H * 0.5;
      for (let x = -STEP * 2; x < W + STEP * 3; x += STEP) {
        const c = makeCandle(x, prevMid, H);
        prevMid = (c.o + c.c) / 2;
        candles.push(c);
      }
    };

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      canvas.width  = W * dpr;
      canvas.height = H * dpr;
      ctx.scale(dpr, dpr);
      seed(W, H);
      initNodes(W, H);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = () => {
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      ctx.clearRect(0, 0, W, H);

      // scroll
      offset += SPD;
      if (offset >= STEP) {
        offset -= STEP;
        candles.shift();
        const last = candles[candles.length - 1];
        const prevMid = (last.o + last.c) / 2;
        candles.push(makeCandle(last.x + STEP, prevMid, H));
      }
      candles.forEach((c, i) => { c.x = i * STEP - offset; });

      // ── MA points ──────────────────────────────────────────
      const buf: number[] = [];
      const ma: { x: number; y: number }[] = [];
      candles.forEach((c) => {
        buf.push((c.o + c.c) / 2);
        if (buf.length > MA_N) buf.shift();
        ma.push({ x: c.x + CW / 2, y: buf.reduce((s, v) => s + v, 0) / buf.length });
      });

      // ── Candles ────────────────────────────────────────────
      candles.forEach((c) => {
        if (c.x < -CW - 2 || c.x > W + 2) return;
        const cx      = c.x + CW / 2;
        const bodyTop = Math.min(c.o, c.c);
        const bodyH   = Math.max(Math.abs(c.c - c.o), 2);

        const green = "rgba(34,197,120,0.52)";
        const red   = "rgba(239,68,68,0.50)";
        const color = c.bull ? green : red;

        // wick
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.moveTo(cx, c.h);
        ctx.lineTo(cx, c.l);
        ctx.stroke();

        // body fill
        ctx.fillStyle = color;
        ctx.fillRect(c.x, bodyTop, CW, bodyH);

        // body outline
        ctx.strokeStyle = c.bull ? "rgba(34,197,120,0.80)" : "rgba(239,68,68,0.78)";
        ctx.lineWidth = 0.6;
        ctx.strokeRect(c.x, bodyTop, CW, bodyH);
      });

      // ── MA line ────────────────────────────────────────────
      const visMA = ma.filter((p) => p.x >= -STEP && p.x <= W + STEP);
      if (visMA.length > 1) {
        // glow pass
        ctx.beginPath();
        ctx.strokeStyle = "rgba(250,204,21,0.18)";
        ctx.lineWidth = 5;
        ctx.lineJoin = "round";
        visMA.forEach((p, i) => { i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y); });
        ctx.stroke();

        // main line
        ctx.beginPath();
        ctx.strokeStyle = "rgba(250,204,21,0.78)";
        ctx.lineWidth = 1.6;
        visMA.forEach((p, i) => { i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y); });
        ctx.stroke();
      }

      // ── Entry / exit on MA reversals ───────────────────────
      for (let i = 2; i < visMA.length - 2; i++) {
        const { x, y } = visMA[i];
        if (x < 4 || x > W - 4) continue;
        const isBot = y > visMA[i - 1].y && y > visMA[i + 1].y;
        const isTop = y < visMA[i - 1].y && y < visMA[i + 1].y;
        if (isBot) {
          ctx.beginPath();
          ctx.fillStyle = "rgba(34,197,120,0.95)";
          ctx.moveTo(x, y + 11); ctx.lineTo(x - 5, y + 3); ctx.lineTo(x + 5, y + 3);
          ctx.closePath(); ctx.fill();
        }
        if (isTop) {
          ctx.beginPath();
          ctx.fillStyle = "rgba(239,68,68,0.92)";
          ctx.moveTo(x, y - 11); ctx.lineTo(x - 5, y - 3); ctx.lineTo(x + 5, y - 3);
          ctx.closePath(); ctx.fill();
        }
      }

      // ── Blockchain chain (nodes + links) ──────────────────
      nodes.forEach((n) => {
        n.x += n.vx; n.y += n.vy;
        if (n.x <  0)         { n.x = 0;         n.vx =  Math.abs(n.vx); }
        if (n.x >  W)         { n.x = W;          n.vx = -Math.abs(n.vx); }
        if (n.y <  H * 0.55) { n.y = H * 0.55;   n.vy =  Math.abs(n.vy); }
        if (n.y >  H * 0.97) { n.y = H * 0.97;   n.vy = -Math.abs(n.vy); }
      });

      const srt = [...nodes].sort((a, b) => a.x - b.x);
      for (let i = 0; i < srt.length - 1; i++) {
        // link line
        ctx.beginPath();
        ctx.moveTo(srt[i].x, srt[i].y);
        ctx.lineTo(srt[i + 1].x, srt[i + 1].y);
        ctx.strokeStyle = "rgba(139,92,246,0.30)";
        ctx.lineWidth = 0.9;
        ctx.stroke();

        // node dot
        ctx.beginPath();
        ctx.arc(srt[i].x, srt[i].y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(167,139,250,0.75)";
        ctx.fill();

        // outer ring
        ctx.beginPath();
        ctx.arc(srt[i].x, srt[i].y, 5, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(167,139,250,0.18)";
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
      // last node
      const last = srt[srt.length - 1];
      ctx.beginPath();
      ctx.arc(last.x, last.y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(167,139,250,0.75)";
      ctx.fill();

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={ref} className="topbar-candle-bg" />;
}
