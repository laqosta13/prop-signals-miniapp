import type { TraderDayStat } from "../api";

type Props = {
  dailyStats: TraderDayStat[];
  className?: string;
};

/** Кумулятивная кривая доходности по дням (как equity curve на биржах). */
export function EquityCurve({ dailyStats, className = "" }: Props) {
  if (dailyStats.length < 2) return null;

  const ordered = [...dailyStats].reverse();
  let cumulative = 0;
  const points = ordered.map((d) => {
    cumulative += d.rating_delta;
    return { date: d.date, value: cumulative };
  });

  const w = 280;
  const h = 72;
  const pad = 4;
  const values = points.map((p) => p.value);
  const minV = Math.min(0, ...values);
  const maxV = Math.max(0, ...values);
  const span = maxV - minV || 1;

  const coords = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (p.value - minV) / span) * (h - pad * 2);
    return { x, y, ...p };
  });

  const line = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const area = `${coords[0].x},${h - pad} ${line} ${coords[coords.length - 1].x},${h - pad}`;
  const last = coords[coords.length - 1];
  const positive = last.value >= 0;

  return (
    <div className={`equity-curve ${className}`.trim()}>
      <p className="equity-curve__head">
        <span>Кривая доходности</span>
        <span className={positive ? "pnl-win" : "pnl-lose"}>
          {last.value >= 0 ? "+" : ""}
          {last.value.toFixed(2)}%
        </span>
      </p>
      <svg viewBox={`0 0 ${w} ${h}`} className="equity-curve__svg" aria-hidden>
        <line x1={pad} y1={h / 2} x2={w - pad} y2={h / 2} className="equity-curve__zero" />
        <polygon points={area} className={positive ? "equity-curve__area equity-curve__area--up" : "equity-curve__area equity-curve__area--down"} />
        <polyline points={line} className={positive ? "equity-curve__line equity-curve__line--up" : "equity-curve__line equity-curve__line--down"} />
      </svg>
    </div>
  );
}
