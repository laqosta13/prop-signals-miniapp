import type { RankIconId } from "../components/RankIcon";

export type RankStyle = {
  bg: string;
  color: string;
  iconId?: RankIconId;
  /** Доп. подсветка бейджа */
  tier?: "apex" | "elite" | "legend";
};

export const RANK_STYLES: Record<number, RankStyle> = {
  10: { bg: "#1a1408", color: "#f5d76e", iconId: "pyramid-eye", tier: "apex" },
  9: { bg: "#1a1608", color: "#f0b429", iconId: "satoshi", tier: "elite" },
  1: { bg: "#2a1f00", color: "#EF9F27", iconId: "crown", tier: "legend" },
  2: { bg: "#2a1200", color: "#EF9F27", iconId: "wolf" },
  3: { bg: "#1a1530", color: "#9b8cff", iconId: "chart-down" },
  4: { bg: "#0e2010", color: "#7dd957", iconId: "kittyra" },
  5: { bg: "#0e2010", color: "#639922", iconId: "clover" },
  6: { bg: "#1a1f2e", color: "#5eb3ff", iconId: "wave" },
  7: { bg: "#1a1f2e", color: "#378ADD", iconId: "bolt" },
  8: { bg: "#222222", color: "#888888", iconId: "zero" },
};

export function rankStyle(rankId: number): RankStyle {
  return RANK_STYLES[rankId] ?? RANK_STYLES[8];
}

export function rankPillExtraClass(rankId: number, featured: boolean): string {
  const st = rankStyle(rankId);
  const parts: string[] = [];
  if (featured) parts.push("rank-badge__pill--featured");
  if (st.tier === "apex") parts.push("rank-badge__pill--apex");
  else if (st.tier === "elite") parts.push("rank-badge__pill--elite");
  else if (st.tier === "legend") parts.push("rank-badge__pill--legend");
  return parts.join(" ");
}

export function rankTierExtraClass(rankId: number): string {
  const t = rankStyle(rankId).tier;
  if (t === "apex") return " rank-guide__tier--apex";
  if (t === "elite") return " rank-guide__tier--elite";
  if (t === "legend") return " rank-guide__tier--legend";
  return "";
}

/** Макс. сумма входа % в одном сигнале (как в backend rank_constants). */
export const RANK_MAX_STAKE_PCT: Record<number, number> = {
  10: 100,
  9: 100,
  1: 50,
  2: 45,
  3: 40,
  4: 35,
  5: 30,
  6: 25,
  7: 20,
  8: 15,
};

export function rankMaxStakePct(rankId: number): number {
  return RANK_MAX_STAKE_PCT[rankId] ?? RANK_MAX_STAKE_PCT[8];
}

/** От худшего к лучшему — как на бэкенде. */
export const RANKS_WORST_TO_BEST = [8, 7, 6, 5, 4, 3, 2, 1, 9, 10] as const;

const RANK_TIERS_LEVERAGE_ONLY_1X = 5;
const RANK_TIERS_ALL_LEVERAGE = 2;

/** Макс. плечо в сигнале: 8–4 → 1×; 3→2×; 2→3×; 1→4×; 9–10 → 5×. */
export function rankMaxLeverage(rankId: number): number {
  const idx = RANKS_WORST_TO_BEST.indexOf(rankId as (typeof RANKS_WORST_TO_BEST)[number]);
  if (idx < 0) return 1;
  if (idx < RANK_TIERS_LEVERAGE_ONLY_1X) return 1;
  if (idx >= RANKS_WORST_TO_BEST.length - RANK_TIERS_ALL_LEVERAGE) return 5;
  return idx - RANK_TIERS_LEVERAGE_ONLY_1X + 2;
}

export type RankTierInfo = {
  id: number;
  name: string;
  rangeLabel: string;
  maxStakePct: number;
  maxLeverage: number;
};

function formatPctRange(minPct: number, maxPct: number): string {
  if (!Number.isFinite(minPct)) return `ниже 0%`;
  if (!Number.isFinite(maxPct)) return `от ${minPct}%`;
  return `${minPct}% — ${maxPct}%`;
}

/** От высшего к низшему. */
export const RANK_TIERS: RankTierInfo[] = [
  {
    id: 10,
    name: "Тот самый глаз пирамиды",
    rangeLabel: formatPctRange(100, Infinity),
    maxStakePct: rankMaxStakePct(10),
    maxLeverage: rankMaxLeverage(10),
  },
  {
    id: 9,
    name: "Сатоши Накамото",
    rangeLabel: formatPctRange(50, 100),
    maxStakePct: rankMaxStakePct(9),
    maxLeverage: rankMaxLeverage(9),
  },
  {
    id: 1,
    name: "Легенда",
    rangeLabel: formatPctRange(30, 50),
    maxStakePct: rankMaxStakePct(1),
    maxLeverage: rankMaxLeverage(1),
  },
  {
    id: 2,
    name: "Волк с Уолл-Стрит",
    rangeLabel: formatPctRange(25, 30),
    maxStakePct: rankMaxStakePct(2),
    maxLeverage: rankMaxLeverage(2),
  },
  {
    id: 3,
    name: "Большой Шорт",
    rangeLabel: formatPctRange(18, 25),
    maxStakePct: rankMaxStakePct(3),
    maxLeverage: rankMaxLeverage(3),
  },
  {
    id: 4,
    name: "Китяра",
    rangeLabel: formatPctRange(12, 18),
    maxStakePct: rankMaxStakePct(4),
    maxLeverage: rankMaxLeverage(4),
  },
  {
    id: 5,
    name: "Зелёная зона",
    rangeLabel: formatPctRange(7, 12),
    maxStakePct: rankMaxStakePct(5),
    maxLeverage: rankMaxLeverage(5),
  },
  {
    id: 6,
    name: "На волне",
    rangeLabel: formatPctRange(3, 7),
    maxStakePct: rankMaxStakePct(6),
    maxLeverage: rankMaxLeverage(6),
  },
  {
    id: 7,
    name: "В рынке",
    rangeLabel: formatPctRange(0, 3),
    maxStakePct: rankMaxStakePct(7),
    maxLeverage: rankMaxLeverage(7),
  },
  {
    id: 8,
    name: "Нулёвый",
    rangeLabel: formatPctRange(-Infinity, 0),
    maxStakePct: rankMaxStakePct(8),
    maxLeverage: rankMaxLeverage(8),
  },
];

export const RANK_RULES: string[] = [
  "Недельный % по закрытым сигналам → ранг.",
  "Подтвердите результат до вс 23:59 МСК.",
  "Минусовая неделя: −1 ранг; две подряд: −2; без подтверждения: ещё −1.",
  "Страховка — 1 раз в месяц, минус не снижает ранг.",
  "Сатоши и «глаз» — вход до 100%; плечо до 5×.",
  "Ниже «Китяры» — плечо 1×; дальше +1× за ранг (до 4×).",
];
