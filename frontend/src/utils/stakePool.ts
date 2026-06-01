/** Пул суммы входа % для копирующих volnovoi. */

export const STAKE_POOL_TOTAL_PCT = 100;

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
      return "100% депозита копирующих задействовано другими активными сигналами";
    }
    return "Сумма входа недоступна для вашего ранга при текущей загрузке пула";
  }
  return "";
}
