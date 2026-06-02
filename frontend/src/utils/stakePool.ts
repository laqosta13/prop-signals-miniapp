/**
 * Пул суммы входа % для копирующих volnovoi.
 * 100% = сумма долей входа (risk_percent) по всем активным сигналам админов,
 * без веса по балансу трекера (20% + 20% у двух трейдеров → занято 40%).
 */

export const STAKE_POOL_TOTAL_PCT = 100;

/** Формат % для чипов лимитов (0 остаётся 0, без подстановки дефолта стопа 0.7). */
export function formatPoolChipPct(pct: number): string {
  if (!Number.isFinite(pct) || pct < 0) return "0";
  const rounded = Math.round(pct * 100) / 100;
  return String(rounded).replace(/\.?0+$/, "");
}

export const STAKE_POOL_MARKS = [0, 25, 50, 75, 100] as const;

export function stakeSliderMarks(maxPct: number): number[] {
  const cap = Math.max(0, Math.min(100, maxPct));
  const marks = STAKE_POOL_MARKS.filter((m) => m <= cap);
  if (cap > 0 && (marks.length === 0 || marks[marks.length - 1] !== cap)) {
    marks.push(Math.round(cap));
  }
  return marks;
}

export function stakePoolBlockedMessage(maxStakePct: number, poolRemainingPct: number): string {
  if (maxStakePct <= 0) {
    if (poolRemainingPct <= 0) {
      return "100% пула суммы входа занято другими активными сигналами";
    }
    return "Сумма входа недоступна для вашего ранга при текущей загрузке пула";
  }
  return "";
}
