import { useId, useMemo, useState } from "react";
import type { TraderDayStat } from "../api";
import { formatDayLabel, formatUsd } from "../utils";

type Props = {
  dailyStats: TraderDayStat[];
  className?: string;
};

type Point = {
  date: string;
  value: number;
  cumPnl: number;
  dayPnl: number;
  dayDelta: number;
  isOrigin?: boolean;
};

const W = 400;
const H = 168;
const PAD = { top: 14, right: 52, bottom: 26, left: 10 };

function fmtPct(v: number) {
  const sign = v > 0 ? "+" : v < 0 ? "-" : "";
  return `${sign}${Math.abs(v).toFixed(2)}%`;
}

function buildPoints(dailyStats: TraderDayStat[]): Point[] {
  const ordered = [...dailyStats].reverse();
  if (ordered.length === 0) return [];

  const points: Point[] = [
    {
      date: ordered[0].date,
      value: 0,
      cumPnl: 0,
      dayPnl: 0,
      dayDelta: 0,
      isOrigin: true,
    },
  ];

  let cumulative = 0;
  let cumulativePnl = 0;
  for (const d of ordered) {
    cumulative += d.rating_delta;
    cumulativePnl += d.pnl_usd;
    points.push({
      date: d.date,
      value: cumulative,
      cumPnl: cumulativePnl,
      dayPnl: d.pnl_usd,
      dayDelta: d.rating_delta,
    });
  }
  return points;
}

function interpolateZero(
  a: { x: number; y: number; value: number },
  b: { x: number; y: number; value: number },
  zeroY: number,
): { x: number; y: number; value: number } | null {
  if (a.value === b.value) return null;
  if ((a.value < 0 && b.value < 0) || (a.value >= 0 && b.value >= 0)) return null;
  const t = (0 - a.value) / (b.value - a.value);
  return {
    x: a.x + t * (b.x - a.x),
    y: zeroY,
    value: 0,
  };
}

type ChartCoord = { x: number; y: number; value: number; date: string; i: number };

function splitAtZero(
  coords: ChartCoord[],
  zeroY: number,
): { tone: "up" | "down"; points: ChartCoord[] }[] {
  const expanded: ChartCoord[] = [];
  for (let i = 0; i < coords.length; i += 1) {
    if (i > 0) {
      const cross = interpolateZero(coords[i - 1], coords[i], zeroY);
      if (cross) {
        expanded.push({ ...cross, date: coords[i].date, i: coords[i].i });
      }
    }
    expanded.push(coords[i]);
  }

  const segments: { tone: "up" | "down"; points: ChartCoord[] }[] = [];
  let current: ChartCoord[] = [];
  let tone: "up" | "down" | null = null;

  const flush = () => {
    if (current.length >= 2 && tone) segments.push({ tone, points: current });
    current = [];
  };

  for (const p of expanded) {
    const nextTone: "up" | "down" = p.value >= 0 ? "up" : "down";
    if (tone != null && nextTone !== tone) {
      current.push(p);
      flush();
      current = [p];
    } else {
      current.push(p);
    }
    tone = nextTone;
  }
  flush();
  return segments;
}

function segmentLine(points: ChartCoord[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

function segmentArea(points: ChartCoord[], zeroY: number): string {
  if (points.length < 2) return "";
  const line = segmentLine(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${first.x},${zeroY} ${line} ${last.x},${zeroY}`;
}

function yTicks(minV: number, maxV: number, _zeroY: number) {
  const span = maxV - minV || 1;
  const steps = span <= 2 ? 3 : span <= 8 ? 4 : 5;
  const raw: number[] = [];
  for (let i = 0; i <= steps; i++) {
    raw.push(minV + (span * i) / steps);
  }
  if (!raw.some((v) => Math.abs(v) < span * 0.02)) raw.push(0);
  return [...new Set(raw.map((v) => Math.round(v * 100) / 100))].sort((a, b) => a - b);
}

/** Кумулятивная кривая доходности по дням — стиль биржевого equity chart. */
export function EquityCurve({ dailyStats, className = "" }: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const gradId = useId().replace(/:/g, "");

  const chart = useMemo(() => {
    const points = buildPoints(dailyStats);
    if (points.length < 2) return null;

    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const values = points.map((p) => p.value);
    const minV = Math.min(0, ...values);
    const maxV = Math.max(0, ...values);
    const span = maxV - minV || 1;

    const toX = (i: number) => PAD.left + (i / (points.length - 1)) * plotW;
    const toY = (v: number) => PAD.top + (1 - (v - minV) / span) * plotH;

    const coords = points.map((p, i) => ({
      ...p,
      x: toX(i),
      y: toY(p.value),
      i,
    }));

    const zeroY = toY(0);
    const segments = splitAtZero(coords, zeroY);
    const last = coords[coords.length - 1];
    const positive = last.value >= 0;
    const ticks = yTicks(minV, maxV, zeroY);

    const xLabels = [
      { i: 0, label: formatDayLabel(points[0].date) },
      { i: points.length - 1, label: formatDayLabel(points[points.length - 1].date) },
    ];
    if (points.length > 4) {
      const mid = Math.floor((points.length - 1) / 2);
      xLabels.splice(1, 0, { i: mid, label: formatDayLabel(points[mid].date) });
    }

    return { points, coords, zeroY, segments, last, positive, ticks, xLabels, toY, plotW, plotH };
  }, [dailyStats]);

  if (!chart) return null;

  const { coords, zeroY, segments, last, positive, ticks, xLabels, toY } = chart;
  const active = hoverIdx != null ? coords[hoverIdx] : last;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestDist = Infinity;
    for (const c of coords) {
      const d = Math.abs(c.x - x);
      if (d < bestDist) {
        bestDist = d;
        best = c.i;
      }
    }
    setHoverIdx(best);
  };

  return (
    <div className={`equity-curve equity-curve--exchange ${className}`.trim()}>
      <div className="equity-curve__toolbar">
        <span className="equity-curve__title">Equity · %</span>
        <span className={`equity-curve__live ${positive ? "pnl-win" : "pnl-lose"}`}>{fmtPct(last.value)}</span>
      </div>

      <div className="equity-curve__stage">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="equity-curve__svg"
          aria-label="Кривая доходности по дням"
          onMouseMove={onMove}
          onMouseLeave={() => setHoverIdx(null)}
          onTouchMove={(e) => {
            const t = e.touches[0];
            if (!t) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const x = ((t.clientX - rect.left) / rect.width) * W;
            let best = 0;
            let bestDist = Infinity;
            for (const c of coords) {
              const d = Math.abs(c.x - x);
              if (d < bestDist) {
                bestDist = d;
                best = c.i;
              }
            }
            setHoverIdx(best);
          }}
          onTouchEnd={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id={`eq-fill-up-${gradId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--green)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--green)" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id={`eq-fill-down-${gradId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--red)" stopOpacity="0.02" />
              <stop offset="100%" stopColor="var(--red)" stopOpacity="0.35" />
            </linearGradient>
          </defs>

          {ticks.map((v) => (
            <g key={v}>
              <line
                x1={PAD.left}
                y1={toY(v)}
                x2={W - PAD.right}
                y2={toY(v)}
                className="equity-curve__grid"
              />
              <text x={W - PAD.right + 6} y={toY(v) + 4} className="equity-curve__ylabel">
                {fmtPct(v)}
              </text>
            </g>
          ))}

          <line x1={PAD.left} y1={zeroY} x2={W - PAD.right} y2={zeroY} className="equity-curve__zero" />

          {segments.map((seg, idx) => {
            const areaPoints = segmentArea(seg.points, zeroY);
            if (!areaPoints) return null;
            return (
              <polygon
                key={`area-${idx}`}
                points={areaPoints}
                fill={`url(#eq-fill-${seg.tone === "up" ? "up" : "down"}-${gradId})`}
                className="equity-curve__area"
              />
            );
          })}
          {segments.map((seg, idx) => (
            <polyline
              key={`line-${idx}`}
              points={segmentLine(seg.points)}
              className={`equity-curve__line equity-curve__line--${seg.tone === "up" ? "up" : "down"}`}
            />
          ))}

          {xLabels.map(({ i, label }) => (
            <text key={`${i}-${label}`} x={coords[i].x} y={H - 6} className="equity-curve__xlabel" textAnchor="middle">
              {label}
            </text>
          ))}

          <circle
            cx={last.x}
            cy={last.y}
            r={3.5}
            className={`equity-curve__dot ${last.value >= 0 ? "pnl-win" : "pnl-lose"}`}
          />

          {hoverIdx != null && (
            <>
              <line x1={active.x} y1={PAD.top} x2={active.x} y2={H - PAD.bottom} className="equity-curve__cross" />
              <circle cx={active.x} cy={active.y} r={4.5} className="equity-curve__dot equity-curve__dot--hover" />
            </>
          )}
        </svg>

        {hoverIdx != null && !active.isOrigin && (
          <div
            className="equity-curve__tip"
            style={{ left: `${(active.x / W) * 100}%` }}
          >
            <span className="equity-curve__tip-date">{formatDayLabel(active.date)}</span>
            <span className={active.value >= 0 ? "pnl-win" : "pnl-lose"}>{fmtPct(active.value)}</span>
            <span className="equity-curve__tip-sub">
              день {active.dayDelta >= 0 ? "+" : ""}
              {active.dayDelta.toFixed(2)}% · {active.dayPnl >= 0 ? "+" : ""}
              {formatUsd(active.dayPnl)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
