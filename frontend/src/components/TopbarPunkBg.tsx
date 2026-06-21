import { useEffect, useRef } from "react";

type Particle = { x: number; y: number; vy: number; life: number; max: number; char: string; col: string };
type Arc      = { x1: number; y1: number; x2: number; y2: number; life: number; max: number };

const HEX_CHARS = ["0x", "FF", "A3", "#", "∑", "01", "B7", "$$", "C4", "1F", "▶", "D2"];
const CYAN  = "rgba(0,240,255,";
const PINK  = "rgba(255,42,109,";
const YELL  = "rgba(252,238,10,";

function lightning(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  depth: number,
  alpha: number,
) {
  if (depth === 0) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    return;
  }
  const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * 14;
  const my = (y1 + y2) / 2 + (Math.random() - 0.5) * 14;
  lightning(ctx, x1, y1, mx, my, depth - 1, alpha);
  lightning(ctx, mx, my, x2, y2, depth - 1, alpha);
}

export function TopbarPunkBg() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;
    let t = 0;
    let nextParticle = 20;
    let nextArc = 60;

    const particles: Particle[] = [];
    const arcs: Arc[] = [];

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width  = canvas.offsetWidth  * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = () => {
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      ctx.clearRect(0, 0, W, H);

      // ── Scanline sweep ──────────────────────────────────────
      const scanY = (t * 0.8) % (H + 4) - 2;
      const scanGrad = ctx.createLinearGradient(0, scanY - 4, 0, scanY + 4);
      scanGrad.addColorStop(0,   "rgba(0,240,255,0.00)");
      scanGrad.addColorStop(0.5, "rgba(0,240,255,0.10)");
      scanGrad.addColorStop(1,   "rgba(0,240,255,0.00)");
      ctx.fillStyle = scanGrad;
      ctx.fillRect(0, scanY - 4, W, 8);

      // ── Electric arcs ───────────────────────────────────────
      nextArc--;
      if (nextArc <= 0) {
        nextArc = 40 + Math.random() * 60;
        arcs.push({
          x1: Math.random() * W,
          y1: Math.random() * H,
          x2: Math.random() * W,
          y2: Math.random() * H,
          life: 0, max: 18 + Math.random() * 12,
        });
      }

      for (let i = arcs.length - 1; i >= 0; i--) {
        const a = arcs[i];
        a.life++;
        if (a.life >= a.max) { arcs.splice(i, 1); continue; }
        const progress = a.life / a.max;
        const alpha = progress < 0.3
          ? (progress / 0.3) * 0.55
          : ((1 - progress) / 0.7) * 0.55;

        ctx.strokeStyle = `${CYAN}${alpha})`;
        ctx.lineWidth = 0.8;
        ctx.shadowColor = "rgba(0,240,255,0.6)";
        ctx.shadowBlur = 4;
        lightning(ctx, a.x1, a.y1, a.x2, a.y2, 3, alpha);
        ctx.shadowBlur = 0;
      }

      // ── Falling hex chars ───────────────────────────────────
      nextParticle--;
      if (nextParticle <= 0) {
        nextParticle = 18 + Math.random() * 28;
        const cols = [
          `${CYAN}`,
          `${PINK}`,
          `${YELL}`,
        ];
        const col = cols[Math.floor(Math.random() * cols.length)];
        particles.push({
          x:    W * 0.04 + Math.random() * W * 0.92,
          y:    -6,
          vy:   0.5 + Math.random() * 0.8,
          life: 0,
          max:  H / 0.65 + Math.random() * 30,
          char: HEX_CHARS[Math.floor(Math.random() * HEX_CHARS.length)],
          col,
        });
      }

      ctx.textBaseline = "top";
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.y += p.vy;
        p.life++;
        if (p.y > H + 10) { particles.splice(i, 1); continue; }
        const progress = p.life / p.max;
        const alpha = progress < 0.15
          ? (progress / 0.15) * 0.60
          : progress > 0.70
            ? ((1 - progress) / 0.30) * 0.60
            : 0.60;
        ctx.font = `700 8px 'SF Mono', monospace`;
        ctx.fillStyle = `${p.col}${alpha})`;
        ctx.fillText(p.char, p.x, p.y);
      }

      // ── Pulse rings (random spawn) ──────────────────────────
      if (t % 90 === 0) {
        const rx = Math.random() * W;
        const ry = Math.random() * H;
        for (let r = 0; r < 3; r++) {
          setTimeout(() => {
            if (!ref.current) return;
            const pulse = { rx, ry, maxR: 18 + r * 8, t: 0 };
            const id = setInterval(() => {
              const c = ref.current?.getContext("2d");
              if (!c || pulse.t > 20) { clearInterval(id); return; }
              const a = (1 - pulse.t / 20) * 0.25;
              const rad = (pulse.t / 20) * pulse.maxR;
              c.beginPath();
              c.arc(pulse.rx, pulse.ry, rad, 0, Math.PI * 2);
              c.strokeStyle = `${CYAN}${a})`;
              c.lineWidth = 0.8;
              c.stroke();
              pulse.t++;
            }, 16);
          }, r * 80);
        }
      }

      t++;
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={ref} className="topbar-candle-bg" />;
}
