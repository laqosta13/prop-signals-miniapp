import { useId, useMemo, useState } from "react";
import type { TraderDayStat } from "../api";
import { formatDayLabel, formatUsd } from "../utils";

export type EquityPeriod = 7 | 30 | 90;

type Props = {
  dailyStats: TraderDayStat[];
  className?: string;
  showDayList?: boolean;
  percentOnly?: boolean;
};

type Point = {
  date: string;
  value: number;
  cumPnl: number;
  dayPnl: number;
  dayDelta: number;
  isOrigin?: boolean;
};

const PERIODS: { id: EquityPeriod; label: string }[] = [
  { id: 7, label: "7д" },
  { id: 30, label: "30д" },
  { id: 90, label: "90д" },
];

const W = 400;
const H = 168;
const PAD = { top: 14, right: 52, bottom: 26, left: 10 };

function fmtPct(v: number) {
  const sign = v > 0 ? "+" : v < 0 ? "-" : "";
  return `${sign}${Math.abs(v).toFixed(2)}%`;
}

export function filterDailyStatsByPeriod(dailyStats: TraderDayStat[], period: EquityPeriod): TraderDayStat[] {
  if (!dailyStats.length) return [];
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - period);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return dailyStats
    .filter((d) => d.date >= cutoffStr)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function buildPoints(dailyStats: TraderDayStat[]): Point[] {
  if (dailyStats.length === 0) return [];

  const points: Point[] = [
    {
      date: dailyStats[0].date,
      value: 0,
      cumPnl: 0,
      dayPnl: 0,
      dayDelta: 0,
      isOrigin: true,
    },
  ];

  let cumulative = 0;
  let cumulativePnl = 0;
  for (const d of dailyStats) {
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

function yTicks(minV: number, maxV: number) {
  const span = maxV - minV || 1;
  const steps = span <= 2 ? 3 : span <= 8 ? 4 : 5;
  const raw: number[] = [];
  for (let i = 0; i <= steps; i++) {
    raw.push(minV + (span * i) / steps);
  }
  if (!raw.some((v) => Math.abs(v) < span * 0.02)) raw.push(0);
  return [...new Set(raw.map((v) => Math.round(v * 100) / 100))].sort((a, b) => a - b);
}

/** Кумулятивная кривая доходности по дням. */
export function EquityCurve({ dailyStats, className = "", showDayList = true, percentOnly = false }: Props) {
  const [period, setPeriod] = useState<EquityPeriod>(7);
  const [daysOpen, setDaysOpen] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const gradId = useId().replace(/:/g, "");

  const filtered = useMemo(() => filterDailyStatsByPeriod(dailyStats, period), [dailyStats, period]);
  const dayList = useMemo(
    () => [...filtered].sort((a, b) => b.date.localeCompare(a.date)),
    [filtered],
  );

  const chart = useMemo(() => {
    const points = buildPoints(filtered);
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
    const ticks = yTicks(minV, maxV);

    const xLabels = [
      { i: 0, label: formatDayLabel(points[0].date) },
      { i: points.length - 1, label: formatDayLabel(points[points.length - 1].date) },
    ];
    if (points.length > 4) {
      const mid = Math.floor((points.length - 1) / 2);
      xLabels.splice(1, 0, { i: mid, label: formatDayLabel(points[mid].date) });
    }

    return { points, coords, zeroY, segments, last, positive, ticks, xLabels, toY };
  }, [filtered]);

  const onPickPeriod = (next: EquityPeriod) => {
    setPeriod(next);
    setHoverIdx(null);
  };

  const pickHover = (x: number, coords: ChartCoord[]) => {
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

  if (!dailyStats.length) return null;

  const active = chart && hoverIdx != null ? chart.coords[hoverIdx] : chart?.last;

  return (
    <div className={`equity-curve equity-curve--exchange ${className}`.trim()} onClick={(e) => e.stopPropagation()}>
      <div className="equity-curve__toolbar">
        <div className="equity-curve__toolbar-main">
          <span className="equity-curve__title">Доходность</span>
          {chart && (
            <span className={`equity-curve__live ${chart.positive ? "pnl-win" : "pnl-lose"}`}>
              {fmtPct(chart.last.value)}
            </span>
          )}
        </div>
        <div className="equity-curve__periods" role="tablist" aria-label="Период графика">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={period === p.id}
              className={`equity-curve__period${period === p.id ? " equity-curve__period--on" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onPickPeriod(p.id);
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {chart ? (
        <div className="equity-curve__stage">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="equity-curve__svg"
            aria-label={`Кривая доходности за ${period} дней`}
            onMouseMove={(e) => pickHover(((e.clientX - e.currentTarget.getBoundingClientRect().left) / e.currentTarget.getBoundingClientRect().width) * W, chart.coords)}
            onMouseLeave={() => setHoverIdx(null)}
            onTouchMove={(e) => {
              const t = e.touches[0];
              if (!t) return;
              pickHover(((t.clientX - e.currentTarget.getBoundingClientRect().left) / e.currentTarget.getBoundingClientRect().width) * W, chart.coords);
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

            {chart.ticks.map((v) => (
              <g key={v}>
                <line x1={PAD.left} y1={chart.toY(v)} x2={W - PAD.right} y2={chart.toY(v)} className="equity-curve__grid" />
                <text x={W - PAD.right + 6} y={chart.toY(v) + 4} className="equity-curve__ylabel">
                  {fmtPct(v)}
                </text>
              </g>
            ))}

            <line x1={PAD.left} y1={chart.zeroY} x2={W - PAD.right} y2={chart.zeroY} className="equity-curve__zero" />

            {chart.segments.map((seg, idx) => {
              const areaPoints = segmentArea(seg.points, chart.zeroY);
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
            {chart.segments.map((seg, idx) => (
              <polyline
                key={`line-${idx}`}
                points={segmentLine(seg.points)}
                className={`equity-curve__line equity-curve__line--${seg.tone === "up" ? "up" : "down"}`}
              />
            ))}

            {chart.xLabels.map(({ i, label }) => (
              <text key={`${i}-${label}`} x={chart.coords[i].x} y={H - 6} className="equity-curve__xlabel" textAnchor="middle">
                {label}
              </text>
            ))}

            <circle
              cx={chart.last.x}
              cy={chart.last.y}
              r={3.5}
              className={`equity-curve__dot ${chart.last.value >= 0 ? "pnl-win" : "pnl-lose"}`}
            />

            {hoverIdx != null && active && (
              <>
                <line x1={active.x} y1={PAD.top} x2={active.x} y2={H - PAD.bottom} className="equity-curve__cross" />
                <circle cx={active.x} cy={active.y} r={4.5} className="equity-curve__dot equity-curve__dot--hover" />
              </>
            )}
          </svg>

          {hoverIdx != null && active && !active.isOrigin && (
            <div className="equity-curve__tip" style={{ left: `${(active.x / W) * 100}%` }}>
              <span className="equity-curve__tip-date">{formatDayLabel(active.date)}</span>
              <span className={active.value >= 0 ? "pnl-win" : "pnl-lose"}>{fmtPct(active.value)}</span>
              <span className="equity-curve__tip-sub">
                {percentOnly ? (
                  <>
                    день {active.dayDelta >= 0 ? "+" : ""}
                    {active.dayDelta.toFixed(2)}%
                  </>
                ) : (
                  <>
                    день {active.dayDelta >= 0 ? "+" : ""}
                    {active.dayDelta.toFixed(2)}% · {active.dayPnl >= 0 ? "+" : ""}
                    {formatUsd(active.dayPnl)}
                  </>
                )}
              </span>
            </div>
          )}
        </div>
      ) : (
        <p className="equity-curve__empty meta">Нет сделок за выбранный период</p>
      )}

      {showDayList && dayList.length > 0 && (
        <div className="equity-curve__days">
          <button
            type="button"
            className={`equity-curve__days-toggle${daysOpen ? " equity-curve__days-toggle--open" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              setDaysOpen((v) => !v);
            }}
            aria-expanded={daysOpen}
          >
            <span>Дни · {dayList.length}</span>
            <span className="equity-curve__days-chevron" aria-hidden>
              {daysOpen ? "▾" : "▸"}
            </span>
          </button>
          {daysOpen && (
            <div className="equity-curve__days-panel">
              <div className={`equity-curve__days-head${percentOnly ? " equity-curve__days-head--pct" : ""}`}>
                <span>День</span>
                {!percentOnly && <span>P/L</span>}
                <span>%</span>
              </div>
              <ul className={`equity-curve__days-list${percentOnly ? " equity-curve__days-list--pct" : ""}`}>
                {dayList.map((d) => (
                  <li key={d.date}>
                    <span>{formatDayLabel(d.date)}</span>
                    {!percentOnly && (
                      <span className={d.pnl_usd >= 0 ? "pnl-win" : "pnl-lose"}>
                        {d.pnl_usd >= 0 ? "+" : ""}
                        {formatUsd(d.pnl_usd)}
                      </span>
                    )}
                    <span className={d.rating_delta >= 0 ? "pnl-win" : "pnl-lose"}>
                      {d.rating_delta >= 0 ? "+" : ""}
                      {d.rating_delta.toFixed(2)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
