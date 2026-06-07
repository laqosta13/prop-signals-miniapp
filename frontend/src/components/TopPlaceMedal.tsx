type Place = 1 | 2 | 3;

type Props = {
  place: Place;
  className?: string;
};

const PALETTE: Record<
  Place,
  { wing: string; shield: string; rim: string; num: string; glow: string }
> = {
  1: {
    wing: "#f5b942",
    shield: "#ffd95a",
    rim: "#fff3b0",
    num: "#5c3d00",
    glow: "rgba(255, 196, 40, 0.75)",
  },
  2: {
    wing: "#b8c9dc",
    shield: "#e8f0f8",
    rim: "#ffffff",
    num: "#2e3f52",
    glow: "rgba(186, 210, 235, 0.7)",
  },
  3: {
    wing: "#c97a45",
    shield: "#e8a56a",
    rim: "#ffd2a8",
    num: "#4a2b12",
    glow: "rgba(210, 130, 70, 0.7)",
  },
};

export function TopPlaceMedal({ place, className = "" }: Props) {
  const c = PALETTE[place];

  return (
    <span
      className={`top-place-medal top-place-medal--${place}${className ? ` ${className}` : ""}`}
      aria-label={`${place} место`}
      role="img"
    >
      <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden>
        <defs>
          <linearGradient id={`top-medal-wing-l-${place}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={c.rim} />
            <stop offset="100%" stopColor={c.wing} />
          </linearGradient>
          <linearGradient id={`top-medal-wing-r-${place}`} x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={c.rim} />
            <stop offset="100%" stopColor={c.wing} />
          </linearGradient>
          <linearGradient id={`top-medal-shield-${place}`} x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor={c.rim} />
            <stop offset="55%" stopColor={c.shield} />
            <stop offset="100%" stopColor={c.wing} />
          </linearGradient>
        </defs>

        <ellipse cx="24" cy="26" rx="18" ry="16" fill={c.glow} opacity="0.45" />

        <path
          d="M6 22 C2 18 2 12 8 10 L14 12 L12 22 Z"
          fill={`url(#top-medal-wing-l-${place})`}
          stroke={c.wing}
          strokeWidth="0.6"
        />
        <path
          d="M42 22 C46 18 46 12 40 10 L34 12 L36 22 Z"
          fill={`url(#top-medal-wing-r-${place})`}
          stroke={c.wing}
          strokeWidth="0.6"
        />
        <path
          d="M10 14 L14 8 L24 6 L34 8 L38 14 L36 30 C34 36 29 40 24 40 C19 40 14 36 12 30 Z"
          fill={`url(#top-medal-shield-${place})`}
          stroke={c.wing}
          strokeWidth="1.2"
        />
        <path
          d="M16 16 L24 12 L32 16 L30 28 C28 32 26 34 24 34 C22 34 20 32 18 28 Z"
          fill="rgba(255,255,255,0.22)"
        />
        <text
          x="24"
          y="27"
          textAnchor="middle"
          dominantBaseline="middle"
          fill={c.num}
          fontSize="16"
          fontWeight="800"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          {place}
        </text>
      </svg>
    </span>
  );
}
