export type RankStyle = {
  bg: string;
  color: string;
  icon?: string;
};

export const RANK_STYLES: Record<number, RankStyle> = {
  1: { bg: "#2a1f00", color: "#EF9F27", icon: "👑" },
  2: { bg: "#2a1200", color: "#EF9F27", icon: "⚡" },
  3: { bg: "#1a1530", color: "#7F77DD", icon: "👁" },
  4: { bg: "#0e2010", color: "#639922" },
  5: { bg: "#0e2010", color: "#639922" },
  6: { bg: "#1a1f2e", color: "#378ADD" },
  7: { bg: "#1a1f2e", color: "#378ADD" },
  8: { bg: "#222222", color: "#888888" },
};

export function rankStyle(rankId: number): RankStyle {
  return RANK_STYLES[rankId] ?? RANK_STYLES[8];
}

/** Макс. сумма входа % в одном сигнале (как в backend rank_constants). */
export const RANK_MAX_STAKE_PCT: Record<number, number> = {
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

export type RankTierInfo = {
  id: number;
  name: string;
  rangeLabel: string;
  maxStakePct: number;
};

function formatPctRange(minPct: number, maxPct: number): string {
  if (!Number.isFinite(minPct)) return `ниже 0%`;
  if (!Number.isFinite(maxPct)) return `от ${minPct}%`;
  return `${minPct}% — ${maxPct}%`;
}

/** От высшего к низшему (Легенда → Нулёвый). */
export const RANK_TIERS: RankTierInfo[] = [
  { id: 1, name: "Легенда", rangeLabel: formatPctRange(30, Infinity), maxStakePct: rankMaxStakePct(1) },
  { id: 2, name: "Волк с Уолл-Стрит", rangeLabel: formatPctRange(25, 30), maxStakePct: rankMaxStakePct(2) },
  { id: 3, name: "Большой Шорт", rangeLabel: formatPctRange(18, 25), maxStakePct: rankMaxStakePct(3) },
  { id: 4, name: "Хищник", rangeLabel: formatPctRange(12, 18), maxStakePct: rankMaxStakePct(4) },
  { id: 5, name: "Зелёная зона", rangeLabel: formatPctRange(7, 12), maxStakePct: rankMaxStakePct(5) },
  { id: 6, name: "На волне", rangeLabel: formatPctRange(3, 7), maxStakePct: rankMaxStakePct(6) },
  { id: 7, name: "В рынке", rangeLabel: formatPctRange(0, 3), maxStakePct: rankMaxStakePct(7) },
  { id: 8, name: "Нулёвый", rangeLabel: formatPctRange(-Infinity, 0), maxStakePct: rankMaxStakePct(8) },
];

export const RANK_RULES: string[] = [
  "Ранг считается по доходности за неделю (% по закрытым сигналам).",
  "Каждый понедельник — пересчёт; до воскресенья 23:59 подтвердите результат в приложении.",
  "Если % недели попадает в диапазон следующего ранга — ранг повышается на ступень.",
  "Минусовая неделя: −1 ступень; две минусовые подряд: −2. Без подтверждения к воскресенью — ещё −1.",
  "Страховка (1 раз в месяц) — одна минусовая неделя не снижает ранг.",
];
