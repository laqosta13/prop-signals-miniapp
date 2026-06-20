import { useEffect, useRef } from "react";

type Node = { x: number; y: number; vx: number; vy: number };
type Label = { x: number; y: number; vy: number; text: string; life: number; max: number };

const FLOAT_LABELS = [
  "$1 234", "+2.34%", "$789", "+0.93%", "TP ✓", "BUY",
  "$1 000", "+5.1%", "−0.9%", "SL", "$2 450", "+1.7%",
];

export function HeroBlockchainBg() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;
    let t = 0;
    let nextLabel = 40;

    const nodes: Node[] = Array.from({ length: 10 }, () => ({
      x: 0, y: 0,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.35,
    }));
    const labels: Label[] = [];

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
      nodes.forEach((n, i) => {
        n.x = (i / (nodes.length - 1)) * w;
        n.y = h * 0.6 + Math.random() * h * 0.3;
      });
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = () => {
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      ctx.clearRect(0, 0, W, H);

      // --- Hex grid (blockchain feel) ---
      const hexR = 16;
      const hexW = hexR * Math.sqrt(3);
      ctx.strokeStyle = "rgba(159,122,234,0.07)";
      ctx.lineWidth = 0.5;
      for (let row = -1; row < H / (hexR * 1.5) + 2; row++) {
        for (let col = -1; col < W / hexW + 2; col++) {
          const cx = col * hexW + (row % 2 === 0 ? 0 : hexW / 2);
          const cy = row * hexR * 1.5;
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const a = (Math.PI / 3) * i - Math.PI / 6;
            const px = cx + hexR * Math.cos(a);
            const py = cy + hexR * Math.sin(a);
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.stroke();
        }
      }

      // --- Price chart ---
      const chartY = (x: number) =>
        H * 0.36 +
        Math.sin((x / W) * 9 + t * 0.011) * H * 0.14 +
        Math.sin((x / W) * 3.5 - t * 0.007) * H * 0.09 +
        Math.sin((x / W) * 19 + t * 0.021) * H * 0.032;

      // Area under chart
      const areaGrad = ctx.createLinearGradient(0, 0, 0, H);
      areaGrad.addColorStop(0, "rgba(61,255,138,0.12)");
      areaGrad.addColorStop(1, "rgba(61,255,138,0.00)");
      ctx.beginPath();
      for (let x = 0; x <= W; x += 3) {
        const y = chartY(x);
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H * 0.85); ctx.lineTo(0, H * 0.85); ctx.closePath();
      ctx.fillStyle = areaGrad;
      ctx.fill();

      // Chart line with glow
      for (let pass = 0; pass < 2; pass++) {
        ctx.beginPath();
        if (pass === 0) {
          ctx.strokeStyle = "rgba(61,255,138,0.18)";
          ctx.lineWidth = 5;
        } else {
          ctx.strokeStyle = "rgba(61,255,138,0.60)";
          ctx.lineWidth = 1.5;
        }
        for (let x = 0; x <= W; x += 3) {
          const y = chartY(x);
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Entry/exit markers
      const step = W / 9;
      for (let xi = 1; xi <= 8; xi++) {
        const x = xi * step;
        const y = chartY(x);
        const yPrev = chartY(x - step * 0.5);
        const yNext = chartY(x + step * 0.5);
        const isMin = y > yPrev && y > yNext;
        const isMax = y < yPrev && y < yNext;
        if (isMin) {
          ctx.beginPath();
          ctx.fillStyle = "rgba(61,255,138,0.85)";
          ctx.moveTo(x, y + 10); ctx.lineTo(x - 4, y + 3); ctx.lineTo(x + 4, y + 3);
          ctx.closePath(); ctx.fill();
        }
        if (isMax) {
          ctx.beginPath();
          ctx.fillStyle = "rgba(255,80,80,0.80)";
          ctx.moveTo(x, y - 10); ctx.lineTo(x - 4, y - 3); ctx.lineTo(x + 4, y - 3);
          ctx.closePath(); ctx.fill();
        }
      }

      // --- Blockchain chain nodes ---
      nodes.forEach((n) => {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0) { n.x = 0; n.vx = Math.abs(n.vx); }
        if (n.x > W) { n.x = W; n.vx = -Math.abs(n.vx); }
        if (n.y < H * 0.58) { n.y = H * 0.58; n.vy = Math.abs(n.vy); }
        if (n.y > H * 0.96) { n.y = H * 0.96; n.vy = -Math.abs(n.vy); }
      });

      const sorted = [...nodes].sort((a, b) => a.x - b.x);
      ctx.strokeStyle = "rgba(159,122,234,0.32)";
      ctx.lineWidth = 0.8;
      for (let i = 0; i < sorted.length - 1; i++) {
        ctx.beginPath();
        ctx.moveTo(sorted[i].x, sorted[i].y);
        ctx.lineTo(sorted[i + 1].x, sorted[i + 1].y);
        ctx.stroke();
        // chain link circle
        ctx.beginPath();
        ctx.arc(sorted[i].x, sorted[i].y, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(159,122,234,0.70)";
        ctx.fill();
        // outer glow ring
        ctx.beginPath();
        ctx.arc(sorted[i].x, sorted[i].y, 4.5, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(159,122,234,0.18)";
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      // --- Floating labels ---
      nextLabel--;
      if (nextLabel <= 0) {
        nextLabel = 50 + Math.random() * 60;
        labels.push({
          x: W * 0.04 + Math.random() * W * 0.88,
          y: H * 0.1 + Math.random() * H * 0.7,
          vy: -0.22 - Math.random() * 0.18,
          text: FLOAT_LABELS[Math.floor(Math.random() * FLOAT_LABELS.length)],
          life: 120, max: 120,
        });
      }

      ctx.font = "700 8px 'SF Mono', 'Courier New', monospace";
      for (let i = labels.length - 1; i >= 0; i--) {
        const lb = labels[i];
        lb.y += lb.vy;
        lb.life--;
        if (lb.life <= 0) { labels.splice(i, 1); continue; }
        const progress = lb.life / lb.max; // 1→0
        const alpha =
          progress > 0.85 ? ((1 - progress) / 0.15) * 0.55
          : progress < 0.2 ? (progress / 0.2) * 0.55
          : 0.55;
        ctx.fillStyle = `rgba(190,210,255,${alpha})`;
        ctx.fillText(lb.text, lb.x, lb.y);
      }

      t++;
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={ref} className="hero-blockchain-bg" />;
}
