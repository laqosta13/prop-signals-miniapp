import { useId } from "react";

type Props = {
  className?: string;
};

/** Полный кибер-логотип VC в стиле CP2077 (жёлтый + циан). */
export function VcPunkLogoMark({ className = "" }: Props) {
  const uid = useId().replace(/:/g, "");

  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <defs>
        <linearGradient id={`vp-edge-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fcee0a" />
          <stop offset="50%" stopColor="#00f0ff" />
          <stop offset="100%" stopColor="#fcee0a" />
        </linearGradient>
        <filter id={`vp-glow-y-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`vp-glow-c-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Внешний светящийся контур гексагона */}
      <path
        className="vc-punk-logo__frame"
        fill="none"
        stroke={`url(#vp-edge-${uid})`}
        strokeWidth="3"
        filter={`url(#vp-glow-c-${uid})`}
        d="M50 7 L88 26.5 L88 73.5 L50 93 L12 73.5 L12 26.5 Z"
      />
      {/* Внутренний тонкий контур */}
      <path
        fill="none"
        stroke="#00f0ff"
        strokeWidth="1"
        opacity="0.4"
        d="M50 11 L84 28.5 L84 71.5 L50 89 L16 71.5 L16 28.5 Z"
      />

      <g className="vc-punk-logo__glitch" opacity="0.4">
        <path
          fill="none"
          stroke="#ff2a6d"
          strokeWidth="3.2"
          d="M24.5 34.5 L31.5 72.5 h4 L42.5 37.5 V29.5 h-4 l-6 31.5 L27 29.5 Z"
        />
        <path
          fill="none"
          stroke="#fcee0a"
          strokeWidth="3.2"
          d="M73 29 C57 28 52.5 39 52.5 50 C52.5 61 57 72 73 71"
        />
      </g>

      <path
        className="vc-punk-logo__letter vc-punk-logo__letter--v"
        fill="rgba(252,238,10,0.06)"
        stroke="#fcee0a"
        strokeWidth="3.4"
        strokeLinejoin="miter"
        filter={`url(#vp-glow-y-${uid})`}
        d="M25.2 29 h3.4 v2.6 l-2.2 1.5 h-1.2 Z
           M23.8 34.2 L31.2 71.8 h4.4 L42 37.2 V29 h-4.4 l-6.2 31.2 L26.8 29 Z"
      />

      <path
        className="vc-punk-logo__letter vc-punk-logo__letter--c"
        fill="none"
        stroke="#00f0ff"
        strokeWidth="4.2"
        strokeLinecap="square"
        filter={`url(#vp-glow-c-${uid})`}
        d="M72 28 C55 27 51 38.5 51 50 C51 61.5 55 73 72 72"
      />

      <circle className="vc-punk-logo__node" cx="50" cy="7" r="1.6" fill="#fcee0a" />
      <circle className="vc-punk-logo__node" cx="88" cy="50" r="1.6" fill="#00f0ff" />
      <circle className="vc-punk-logo__node" cx="50" cy="93" r="1.6" fill="#fcee0a" />
      <circle className="vc-punk-logo__node" cx="12" cy="50" r="1.6" fill="#00f0ff" />

      <path
        className="vc-punk-logo__data"
        fill="none"
        stroke="#00f0ff"
        strokeWidth="0.8"
        opacity="0.55"
        d="M22 50 h12 M66 50 h12"
      />
    </svg>
  );
}
