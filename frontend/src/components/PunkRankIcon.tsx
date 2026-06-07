import type { RankIconId } from "./RankIcon";

type Props = {
  id: RankIconId;
  size?: number;
  className?: string;
};

const stroke = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  strokeWidth: 1.75,
};

/** Неоновые wireframe-иконки рангов для темы МА. */
export function PunkRankIcon({ id, size = 18, className = "" }: Props) {
  return (
    <span className={`rank-icon-wrap rank-icon-wrap--punk rank-icon-wrap--${id}`} style={{ width: size, height: size }}>
      <span className="rank-icon__shimmer" aria-hidden />
      <span className="rank-icon__spark rank-icon__spark--a" aria-hidden />
      <span className="rank-icon__spark rank-icon__spark--b" aria-hidden />
      <svg
        width={size}
        height={size}
        className={`rank-icon rank-icon--punk rank-icon--${id} rank-icon__svg ${className}`.trim()}
        viewBox="0 0 24 24"
        aria-hidden
      >
        <g className="rank-icon__anim">{glyph(id)}</g>
      </svg>
    </span>
  );
}

function glyph(id: RankIconId) {
  switch (id) {
    case "pyramid-eye":
      return (
        <>
          <path {...stroke} d="M12 4 4 20h16L12 4z" />
          <path {...stroke} strokeWidth={1.2} d="M8 17h8" />
          <circle className="rank-icon__eye" cx="12" cy="12.5" r="2.4" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth={1.2} />
          <circle cx="12" cy="12.5" r="0.9" fill="currentColor" stroke="none" />
        </>
      );
    case "satoshi":
      return (
        <>
          <circle cx="12" cy="12" r="8.5" {...stroke} />
          <circle cx="12" cy="12" r="6.5" {...stroke} strokeWidth={1} opacity="0.45" />
          <text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="700" fill="currentColor" stroke="none" fontFamily="var(--font-display, monospace)">
            ₿
          </text>
        </>
      );
    case "crown":
      return (
        <>
          <path {...stroke} d="M5 17h14l-1.2-5.5-2 3.5-1.5-5-1.5 5-2-3.5L7 17z" />
          <circle className="rank-icon__gem rank-icon__gem--a" cx="7.2" cy="8" r="1" fill="currentColor" stroke="none" />
          <circle className="rank-icon__gem rank-icon__gem--b" cx="12" cy="6" r="1.1" fill="currentColor" stroke="none" />
          <circle className="rank-icon__gem rank-icon__gem--c" cx="16.8" cy="8" r="1" fill="currentColor" stroke="none" />
        </>
      );
    case "wolf":
      return (
        <>
          <path {...stroke} d="M6 15c2-3 4-4.5 6-4.5s4 1.5 6 4.5" />
          <path {...stroke} strokeWidth={1.4} d="M8.5 10 7 7.5M15.5 10 17 7.5" />
          <circle cx="9.5" cy="12.5" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="14.5" cy="12.5" r="0.9" fill="currentColor" stroke="none" />
        </>
      );
    case "chart-down":
      return (
        <>
          <path {...stroke} d="M5 19V5M5 19h14" />
          <path className="rank-icon__chart-line" {...stroke} strokeWidth={2} d="M8 15.5l3-3 3 2.2 4.5-6.5" />
          <path {...stroke} d="M17 8.5v5h-5" />
        </>
      );
    case "kittyra":
      return (
        <>
          <path {...stroke} d="M4 13c2-3 5-4.5 8-4.5s6 1.5 8 4.5" />
          <path className="rank-icon__tail" {...stroke} d="M4 13 2.5 10.5v4" />
          <path {...stroke} strokeWidth={1.4} d="M9 7.5 8.2 5.5h1.4l.3 2zM15 7.5 15.8 5.5h-1.4l-.3 2z" />
          <circle cx="16" cy="12" r="1" fill="currentColor" stroke="none" />
        </>
      );
    case "clover":
      return (
        <>
          <circle className="rank-icon__leaf" cx="12" cy="8" r="2.2" {...stroke} />
          <circle className="rank-icon__leaf" cx="8" cy="12.5" r="2.2" {...stroke} />
          <circle className="rank-icon__leaf" cx="16" cy="12.5" r="2.2" {...stroke} />
          <path {...stroke} d="M12 10v8M10 17h4" />
        </>
      );
    case "wave":
      return (
        <>
          <path className="rank-icon__wave-line" {...stroke} strokeWidth={2} d="M3 14c2.5-2.5 5-2.5 7.5 0s5 2.5 7.5 0 5-2.5 7.5 0" />
          <path className="rank-icon__wave-line rank-icon__wave-line--b" {...stroke} strokeWidth={1.4} opacity="0.55" d="M3 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
        </>
      );
    case "bolt":
      return (
        <path className="rank-icon__bolt" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth={1} d="M13.2 2.5 7.8 13.2h4.2l-1.2 8.3 8-12.5h-4.2l-1.4-6.5z" />
      );
    case "zero":
      return (
        <>
          <circle cx="12" cy="12" r="7.5" {...stroke} />
          <path className="rank-icon__zero-bar" {...stroke} strokeWidth={2.2} d="M9 12h6" />
        </>
      );
    default:
      return null;
  }
}
