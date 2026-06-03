export type RankIconId =
  | "pyramid-eye"
  | "satoshi-pyramid"
  | "crown"
  | "wolf"
  | "chart-down"
  | "shark"
  | "clover"
  | "wave"
  | "bolt"
  | "zero";

type Props = {
  id: RankIconId;
  size?: number;
  className?: string;
};

const stroke = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function RankIcon({ id, size = 18, className = "" }: Props) {
  const cls = `rank-icon${className ? ` ${className}` : ""}`;
  const dim = { width: size, height: size, className: cls, viewBox: "0 0 24 24", "aria-hidden": true };

  switch (id) {
    case "pyramid-eye":
      return (
        <svg {...dim}>
          <path {...stroke} d="M12 4 4 20h16L12 4z" />
          <path {...stroke} d="M8 16h8" />
          <circle cx="12" cy="13" r="2.25" fill="currentColor" stroke="none" />
          <circle cx="12" cy="13" r="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
    case "satoshi-pyramid":
      return (
        <svg {...dim}>
          <path {...stroke} d="M12 5 5 19h14L12 5z" />
          <path {...stroke} d="M8.5 16h7" />
          <text
            x="12"
            y="15.5"
            textAnchor="middle"
            fontSize="6.5"
            fontWeight="700"
            fill="currentColor"
            stroke="none"
            fontFamily="system-ui, sans-serif"
          >
            B
          </text>
        </svg>
      );
    case "crown":
      return (
        <svg {...dim}>
          <path
            {...stroke}
            d="M5 17h14M7 17l1.2-7 2.3 4 1.5-6 1.5 6 2.3-4L17 17"
          />
          <circle cx="7.5" cy="8" r="1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="6" r="1" fill="currentColor" stroke="none" />
          <circle cx="16.5" cy="8" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "wolf":
      return (
        <svg {...dim}>
          <path
            {...stroke}
            d="M6 14c1.5-3 3-4.5 6-4.5s4.5 1.5 6 4.5M9 10l-1.5-2M15 10l1.5-2M10 16h4"
          />
          <circle cx="9.5" cy="12" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="14.5" cy="12" r="0.9" fill="currentColor" stroke="none" />
          <path {...stroke} d="M11 13.5h2" />
        </svg>
      );
    case "chart-down":
      return (
        <svg {...dim}>
          <path {...stroke} d="M5 19V5M5 19h14" />
          <path {...stroke} d="M8 15l3-3 3 2 4-6" />
          <path {...stroke} d="M17 8v5h-5" />
        </svg>
      );
    case "shark":
      return (
        <svg {...dim}>
          <path
            {...stroke}
            d="M4 13c2-2 4-3 7-3 2.5 0 4.5.8 6.5 2.5 1.2 1 2.2 1.5 3.5 1.5H20l-2-2"
          />
          <path {...stroke} d="M7 11l-2-1M9 9V7" />
          <circle cx="15" cy="12" r="0.8" fill="currentColor" stroke="none" />
        </svg>
      );
    case "clover":
      return (
        <svg {...dim}>
          <circle cx="12" cy="8" r="2.2" {...stroke} />
          <circle cx="8" cy="12" r="2.2" {...stroke} />
          <circle cx="16" cy="12" r="2.2" {...stroke} />
          <path {...stroke} d="M12 10v8M10 16h4" />
        </svg>
      );
    case "wave":
      return (
        <svg {...dim}>
          <path {...stroke} d="M4 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
          <path {...stroke} d="M4 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0" opacity="0.55" />
        </svg>
      );
    case "bolt":
      return (
        <svg {...dim}>
          <path
            fill="currentColor"
            stroke="none"
            d="M13 3 8 13h4l-1 8 7-11h-4l-1-7z"
          />
        </svg>
      );
    case "zero":
      return (
        <svg {...dim}>
          <circle cx="12" cy="12" r="7" {...stroke} />
          <path {...stroke} d="M9 12h6" strokeWidth="2.2" />
        </svg>
      );
    default:
      return null;
  }
}
