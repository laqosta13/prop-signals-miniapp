import { useId } from "react";

type Props = {
  className?: string;
};

/** Полный кибер-логотип VC для темы МА. */
export function VcPunkLogoMark({ className = "" }: Props) {
  const uid = useId().replace(/:/g, "");

  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <defs>
        <linearGradient id={`vp-bg-${uid}`} x1="30%" y1="0%" x2="70%" y2="100%">
          <stop offset="0%" stopColor="#160a22" />
          <stop offset="55%" stopColor="#08040f" />
          <stop offset="100%" stopColor="#040208" />
        </linearGradient>
        <linearGradient id={`vp-edge-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#39ff14" />
          <stop offset="45%" stopColor="#bc13fe" />
          <stop offset="100%" stopColor="#39ff14" />
        </linearGradient>
        <linearGradient id={`vp-scan-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(57,255,20,0.14)" />
          <stop offset="100%" stopColor="rgba(188,19,254,0.08)" />
        </linearGradient>
        <pattern id={`vp-lines-${uid}`} width="100" height="3" patternUnits="userSpaceOnUse">
          <rect width="100" height="1" fill="rgba(57,255,20,0.07)" />
        </pattern>
        <filter id={`vp-glow-g-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`vp-glow-p-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id={`vp-hex-${uid}`}>
          <path d="M50 15.5 L78.5 31.5 L78.5 68.5 L50 84.5 L21.5 68.5 L21.5 31.5 Z" />
        </clipPath>
      </defs>

      {/* Тёмное ядро */}
      <path
        fill={`url(#vp-bg-${uid})`}
        d="M50 15.5 L78.5 31.5 L78.5 68.5 L50 84.5 L21.5 68.5 L21.5 31.5 Z"
      />

      {/* Сканлайны внутри шестиугольника */}
      <rect
        x="0"
        y="0"
        width="100"
        height="100"
        fill={`url(#vp-lines-${uid})`}
        clipPath={`url(#vp-hex-${uid})`}
        opacity="0.9"
      />

      {/* Внешняя неоновая рамка */}
      <path
        className="vc-punk-logo__frame"
        fill="none"
        stroke={`url(#vp-edge-${uid})`}
        strokeWidth="3"
        filter={`url(#vp-glow-p-${uid})`}
        d="M50 7 L88 26.5 L88 73.5 L50 93 L12 73.5 L12 26.5 Z"
      />
      <path
        fill="none"
        stroke="#bc13fe"
        strokeWidth="1"
        opacity="0.45"
        d="M50 11 L84 28.5 L84 71.5 L50 89 L16 71.5 L16 28.5 Z"
      />

      {/* Глич-слой букв */}
      <g className="vc-punk-logo__glitch" opacity="0.45">
        <path
          fill="none"
          stroke="#ff2bd6"
          strokeWidth="3.2"
          d="M24.5 34.5 L31.5 72.5 h4 L42.5 37.5 V29.5 h-4 l-6 31.5 L27 29.5 Z"
        />
        <path
          fill="none"
          stroke="#00f0ff"
          strokeWidth="3.2"
          d="M70 31 C58 31 54.5 40.5 54.5 50.5 C54.5 60.5 58 70 70 70"
        />
      </g>

      {/* V — неон зелёный */}
      <path
        className="vc-punk-logo__letter vc-punk-logo__letter--v"
        fill="rgba(57,255,20,0.06)"
        stroke="#39ff14"
        strokeWidth="3.4"
        strokeLinejoin="miter"
        filter={`url(#vp-glow-g-${uid})`}
        d="M25.2 29 h3.4 v2.6 l-2.2 1.5 h-1.2 Z
           M23.8 34.2 L31.2 71.8 h4.4 L42 37.2 V29 h-4.4 l-6.2 31.2 L26.8 29 Z"
      />

      {/* C — неон фиолетовый */}
      <path
        className="vc-punk-logo__letter vc-punk-logo__letter--c"
        fill="none"
        stroke="#bc13fe"
        strokeWidth="4.2"
        strokeLinecap="square"
        filter={`url(#vp-glow-p-${uid})`}
        d="M69 30.5 C57.5 30.5 54 40 54 50 C54 60 57.5 69.5 69 69.5"
      />

      {/* Circuit-узлы на вершинах */}
      <circle className="vc-punk-logo__node" cx="50" cy="7" r="1.6" fill="#39ff14" />
      <circle className="vc-punk-logo__node" cx="88" cy="50" r="1.6" fill="#bc13fe" />
      <circle className="vc-punk-logo__node" cx="50" cy="93" r="1.6" fill="#39ff14" />
      <circle className="vc-punk-logo__node" cx="12" cy="50" r="1.6" fill="#bc13fe" />

      {/* Горизонтальные data-lines */}
      <path
        className="vc-punk-logo__data"
        fill="none"
        stroke="#39ff14"
        strokeWidth="0.8"
        opacity="0.55"
        d="M22 50 h12 M66 50 h12"
      />
    </svg>
  );
}
