import { useEffect, useRef } from "react";

type Node  = { x: number; y: number; vx: number; vy: number };
type Dollar = { x: number; y: number; vy: number; vx: number; life: number; max: number; text: string; size: number };

const TEXTS = ["$", "$", "$", "$$", "$1K", "$100", "+%", "$$$"];

export function TopbarCandleBg() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;
    let nextSpawn = 30;

    const nodes: Node[] = Array.from({ length: 8 }, () => ({
      x: 0, y: 0,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.4,
    }));
    const dollars: Dollar[] = [];

    const initNodes = (W: number, H: number) => {
      nodes.forEach((n, i) => {
        n.x = (i / (nodes.length - 1)) * W;
        n.y = H * 0.4 + Math.random() * H * 0.5;
      });
    };

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      canvas.width  = W * dpr;
      canvas.height = H * dpr;
      ctx.scale(dpr, dpr);
      initNodes(W, H);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = () => {
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      ctx.clearRect(0, 0, W, H);

      // ── Blockchain nodes + links ──────────────────────────
      nodes.forEach((n) => {
        n.x += n.vx; n.y += n.vy;
        if (n.x <  0)        { n.x = 0;        n.vx =  Math.abs(n.vx); }
        if (n.x >  W)        { n.x = W;         n.vx = -Math.abs(n.vx); }
        if (n.y <  H * 0.1)  { n.y = H * 0.1;   n.vy =  Math.abs(n.vy); }
        if (n.y >  H * 0.92) { n.y = H * 0.92;  n.vy = -Math.abs(n.vy); }
      });

      const srt = [...nodes].sort((a, b) => a.x - b.x);

      // links
      for (let i = 0; i < srt.length - 1; i++) {
        ctx.beginPath();
        ctx.moveTo(srt[i].x, srt[i].y);
        ctx.lineTo(srt[i + 1].x, srt[i + 1].y);
        ctx.strokeStyle = "rgba(139,92,246,0.32)";
        ctx.lineWidth = 0.9;
        ctx.stroke();
      }

      // nodes
      srt.forEach((n) => {
        // glow ring
        ctx.beginPath();
        ctx.arc(n.x, n.y, 5.5, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(167,139,250,0.16)";
        ctx.lineWidth = 1;
        ctx.stroke();
        // dot
        ctx.beginPath();
        ctx.arc(n.x, n.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(167,139,250,0.80)";
        ctx.fill();
      });

      // ── Flying dollars ────────────────────────────────────
      nextSpawn--;
      if (nextSpawn <= 0) {
        nextSpawn = 25 + Math.random() * 35;
        dollars.push({
          x:    Math.random() * W * 0.9 + W * 0.05,
          y:    H * 0.85 + Math.random() * H * 0.1,
          vy:  -(0.6 + Math.random() * 0.7),
          vx:   (Math.random() - 0.5) * 0.4,
          life: 0,
          max:  80 + Math.random() * 50,
          text: TEXTS[Math.floor(Math.random() * TEXTS.length)],
          size: 7 + Math.random() * 5,
        });
      }

      for (let i = dollars.length - 1; i >= 0; i--) {
        const d = dollars[i];
        d.x   += d.vx;
        d.y   += d.vy;
        d.life++;
        if (d.life >= d.max) { dollars.splice(i, 1); continue; }

        const progress = d.life / d.max; // 0→1
        const alpha = progress < 0.15
          ? (progress / 0.15) * 0.65
          : progress > 0.75
            ? ((1 - progress) / 0.25) * 0.65
            : 0.65;

        ctx.font = `700 ${d.size}px 'SF Mono', monospace`;
        ctx.fillStyle = `rgba(250,204,21,${alpha})`;
        ctx.fillText(d.text, d.x, d.y);
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={ref} className="topbar-candle-bg" />;
}
