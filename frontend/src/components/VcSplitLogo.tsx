import { useId } from "react";
import { useAppTheme } from "../hooks/useAppTheme";

type Props = {
  size?: number;
  className?: string;
};

/** VC в шестиугольнике: V — классика (золото), C — кибер (неон). */
export function VcSplitLogo({ size = 32, className = "" }: Props) {
  const theme = useAppTheme();
  const punk = theme === "punk";
  const uid = useId().replace(/:/g, "");
  const clipClassic = `vc-classic-${uid}`;
  const clipCyber = `vc-cyber-${uid}`;

  return (
    <span
      className={`vc-split-logo${punk ? " vc-split-logo--punk-active" : " vc-split-logo--classic-active"}${className ? ` ${className}` : ""}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label="Volnovoi Cult"
    >
      <svg viewBox="0 0 100 100" className="vc-split-logo__svg" aria-hidden>
        <defs>
          <clipPath id={clipClassic}>
            <rect x="0" y="0" width="50" height="100" />
          </clipPath>
          <clipPath id={clipCyber}>
            <rect x="50" y="0" width="50" height="100" />
          </clipPath>

          <linearGradient id={`vc-gold-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f0d78c" />
            <stop offset="38%" stopColor="#c9a227" />
            <stop offset="72%" stopColor="#e8c96a" />
            <stop offset="100%" stopColor="#9a7b1a" />
          </linearGradient>
          <linearGradient id={`vc-gold-shine-${uid}`} x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#fff8dc" stopOpacity="0.55" />
            <stop offset="45%" stopColor="#fff8dc" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`vc-cyber-bg-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#120a1e" />
            <stop offset="100%" stopColor="#06040c" />
          </linearGradient>
          <linearGradient id={`vc-cyber-edge-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#bc13fe" />
            <stop offset="55%" stopColor="#39ff14" />
            <stop offset="100%" stopColor="#bc13fe" />
          </linearGradient>

          <filter id={`vc-neon-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ── Classic: V + левая половина шестиугольника ── */}
        <g clipPath={`url(#${clipClassic})`} className="vc-split-logo__classic">
          <path
            className="vc-split-logo__hex-frame"
            fill={`url(#vc-gold-${uid})`}
            d="M50 7 L88 26.5 L88 73.5 L50 93 L12 73.5 L12 26.5 Z
               M50 15.5 L78.5 31.5 L78.5 68.5 L50 84.5 L21.5 68.5 L21.5 31.5 Z"
            fillRule="evenodd"
          />
          <path
            className="vc-split-logo__hex-face"
            fill="#1a1610"
            d="M50 15.5 L78.5 31.5 L78.5 68.5 L50 84.5 L21.5 68.5 L21.5 31.5 Z"
          />
          <path
            className="vc-split-logo__letter vc-split-logo__letter--v"
            fill="#0c0a08"
            d="M25.2 29 h3.4 v2.6 l-2.2 1.5 h-1.2 Z
               M23.8 34.2 L31.2 71.8 h4.4 L42 37.2 V29 h-4.4 l-6.2 31.2 L26.8 29 Z"
          />
          <path
            className="vc-split-logo__shine"
            fill={`url(#vc-gold-shine-${uid})`}
            d="M50 15.5 L78.5 31.5 L78.5 68.5 L50 84.5 L21.5 68.5 L21.5 31.5 Z"
            opacity="0.35"
          />
        </g>

        {/* ── Cyber: C + правая половина шестиугольника ── */}
        <g clipPath={`url(#${clipCyber})`} className="vc-split-logo__cyber">
          <path
            className="vc-split-logo__hex-face vc-split-logo__hex-face--cyber"
            fill={`url(#vc-cyber-bg-${uid})`}
            d="M50 15.5 L78.5 31.5 L78.5 68.5 L50 84.5 L21.5 68.5 L21.5 31.5 Z"
          />
          <path
            className="vc-split-logo__hex-stroke"
            fill="none"
            stroke={`url(#vc-cyber-edge-${uid})`}
            strokeWidth="2.8"
            filter={`url(#vc-neon-${uid})`}
            d="M50 7 L88 26.5 L88 73.5 L50 93 L12 73.5 L12 26.5 Z"
          />
          <path
            className="vc-split-logo__hex-stroke vc-split-logo__hex-stroke--inner"
            fill="none"
            stroke="#bc13fe"
            strokeWidth="1.2"
            opacity="0.65"
            d="M50 15.5 L78.5 31.5 L78.5 68.5 L50 84.5 L21.5 68.5 L21.5 31.5 Z"
          />
          <path
            className="vc-split-logo__letter vc-split-logo__letter--c"
            fill="none"
            stroke="#39ff14"
            strokeWidth="4.2"
            strokeLinecap="square"
            filter={`url(#vc-neon-${uid})`}
            d="M69 30.5 C57.5 30.5 54 40 54 50 C54 60 57.5 69.5 69 69.5"
          />
          <path
            className="vc-split-logo__circuit"
            fill="none"
            stroke="#bc13fe"
            strokeWidth="1"
            opacity="0.7"
            d="M72 22 h8 M76 22 v4 M68 78 h10"
          />
          <circle className="vc-split-logo__node" cx="80" cy="22" r="1.4" fill="#39ff14" />
          <circle className="vc-split-logo__node" cx="78" cy="78" r="1.4" fill="#bc13fe" />
        </g>

        <line className="vc-split-logo__seam" x1="50" y1="12" x2="50" y2="88" />
      </svg>
    </span>
  );
}
