import type { Theme } from "./theme";

/** Панк-имена рангов — отдельная вселенная Cult. */
export const PUNK_RANK_NAMES: Record<number, string> = {
  10: "ВСЕВИДЯЩИЙ",
  9: "ПРИЗРАК САТОШИ",
  1: "ЛЕГЕНДА НЕОНА",
  2: "ВОЛК НЕОНА",
  3: "КРАХОВОЙ",
  4: "КИТ ТЕНИ",
  5: "ЗЕЛЁНЫЙ ПУЛЬС",
  6: "ВОЛНОВОЙ",
  7: "В СЕТКЕ",
  8: "ПРИЗРАК",
};

export const PUNK_RANK_GUIDE_TITLE = "КОД ДОСТУПА";
export const PUNK_RANK_GUIDE_INTRO =
  "Ты внутри неоновой сети. Каждый понедельник код пересчитывается сам — чем выше уровень, тем больше огонь в операции.";
export const PUNK_RANK_GUIDE_POOL =
  "Общий пул входа: если сеть забита на 100%, следующий оператор в эту сделку не пройдёт.";

export function isPunkTheme(theme: Theme): boolean {
  return theme === "punk";
}

export function resolveRankName(rankId: number, defaultName: string, theme: Theme): string {
  if (!isPunkTheme(theme)) return defaultName;
  return PUNK_RANK_NAMES[rankId] ?? defaultName.toUpperCase();
}
