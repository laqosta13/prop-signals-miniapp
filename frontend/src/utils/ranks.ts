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
