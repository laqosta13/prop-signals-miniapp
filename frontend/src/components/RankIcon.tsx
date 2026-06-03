export type RankIconId =
  | "pyramid-eye"
  | "satoshi"
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

const strokeRound = {
  fill: "none" as const,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  strokeWidth: 1.75,
};

export function RankIcon({ id, size = 18, className = "" }: Props) {
  const cls = `rank-icon rank-icon--${id}${className ? ` ${className}` : ""}`;
  const dim = { width: size, height: size, className: cls, viewBox: "0 0 24 24", "aria-hidden": true };

  switch (id) {
    case "pyramid-eye":
      return (
        <svg {...dim}>
          <path
            {...strokeRound}
            stroke="#e8c547"
            fill="#3d3218"
            d="M12 3.5 3.5 20.5h17L12 3.5z"
          />
          <path {...strokeRound} stroke="#c9a227" d="M7.5 17h9" />
          <circle cx="12" cy="12.5" r="2.6" fill="#f5efd0" stroke="#c9a227" strokeWidth="1.2" />
          <circle cx="12" cy="12.5" r="1.1" fill="#1c2840" stroke="none" />
        </svg>
      );
    case "satoshi":
      return (
        <svg {...dim}>
          <circle cx="12" cy="12" r="9" fill="#f7931a" stroke="#ffb347" strokeWidth="1.5" />
          <circle cx="12" cy="12" r="7.2" fill="none" stroke="#fff8e8" strokeWidth="0.75" opacity="0.5" />
          <text
            x="12"
            y="16"
            textAnchor="middle"
            fontSize="11"
            fontWeight="700"
            fill="#ffffff"
            stroke="none"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            ₿
          </text>
        </svg>
      );
    case "crown":
      return (
        <svg {...dim}>
          <path
            {...strokeRound}
            stroke="#ffd54a"
            fill="#5c4208"
            d="M5 16.5h14l-1.5-6.5-2.2 3.8-1.6-5.5-1.6 5.5-2.2-3.8L7 16.5z"
          />
          <circle cx="7.2" cy="7.8" r="1.1" fill="#e24b4a" stroke="none" />
          <circle cx="12" cy="5.8" r="1.2" fill="#7dd957" stroke="none" />
          <circle cx="16.8" cy="7.8" r="1.1" fill="#5eb3ff" stroke="none" />
        </svg>
      );
    case "wolf":
      return (
        <svg {...dim}>
          <path
            {...strokeRound}
            stroke="#b8c2d0"
            fill="#4a5568"
            d="M6 14.5c1.8-3.2 3.5-4.8 6-4.8s4.2 1.6 6 4.8"
          />
          <path {...strokeRound} stroke="#dfe6ef" d="M8.5 10.2 7 8M15.5 10.2 17 8" />
          <circle cx="9.4" cy="12.2" r="1" fill="#5eb3ff" stroke="none" />
          <circle cx="14.6" cy="12.2" r="1" fill="#5eb3ff" stroke="none" />
          <path {...strokeRound} stroke="#dfe6ef" d="M10.5 14h3" />
        </svg>
      );
    case "chart-down":
      return (
        <svg {...dim}>
          <path {...strokeRound} stroke="#6b7280" d="M5 19V5M5 19h14" />
          <path {...strokeRound} stroke="#e24b4a" strokeWidth="2" d="M8 15.5l3-3 3 2.2 4.5-6.5" />
          <path {...strokeRound} stroke="#f07178" d="M17 8.5v5h-5" />
        </svg>
      );
    case "shark":
      return (
        <svg {...dim}>
          <path
            {...strokeRound}
            stroke="#5eb3ff"
            fill="#1e3a5f"
            d="M4 13.2c2.2-2.2 4.2-3.2 7.2-3.2 2.6 0 4.7.9 6.7 2.6 1.3 1.1 2.3 1.6 3.6 1.6H20l-2.2-2.2"
          />
          <path {...strokeRound} stroke="#9ec8ff" d="M7 11l-2.2-1.2M9.2 8.8V7" />
          <circle cx="15.2" cy="12.2" r="0.9" fill="#fff" stroke="none" />
        </svg>
      );
    case "clover":
      return (
        <svg {...dim}>
          <circle cx="12" cy="7.8" r="2.3" fill="#63c74d" stroke="#3d9a32" strokeWidth="1.2" />
          <circle cx="8" cy="12" r="2.3" fill="#63c74d" stroke="#3d9a32" strokeWidth="1.2" />
          <circle cx="16" cy="12" r="2.3" fill="#63c74d" stroke="#3d9a32" strokeWidth="1.2" />
          <path {...strokeRound} stroke="#3d9a32" d="M12 9.8v9M10 16.5h4" />
        </svg>
      );
    case "wave":
      return (
        <svg {...dim}>
          <path {...strokeRound} stroke="#5eb3ff" strokeWidth="2" d="M3.5 14c2.5-2.5 5-2.5 7.5 0s5 2.5 7.5 0 5-2.5 7.5 0" />
          <path {...strokeRound} stroke="#378add" strokeWidth="1.5" opacity="0.65" d="M3.5 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
        </svg>
      );
    case "bolt":
      return (
        <svg {...dim}>
          <path fill="#ffd54a" stroke="#f0a500" strokeWidth="0.8" d="M13.2 2.5 7.8 13.2h4.2l-1.2 8.3 8-12.5h-4.2l-1.4-6.5z" />
        </svg>
      );
    case "zero":
      return (
        <svg {...dim}>
          <circle cx="12" cy="12" r="7.5" fill="#2a2a2a" stroke="#9aa0a6" strokeWidth="1.75" />
          <path {...strokeRound} stroke="#c4c8cc" strokeWidth="2.2" d="M9 12h6" />
        </svg>
      );
    default:
      return null;
  }
}
