/**
 * Пул суммы входа % для копирующих volnovoi.
 * 100% = сумма долей входа (risk_percent) по всем активным сигналам админов,
 * без веса по балансу трекера (20% + 20% у двух трейдеров → занято 40%).
 */

import { evenSliderMarks } from "./sliderMarks";

export const STAKE_POOL_TOTAL_PCT = 100;

/** Формат % для чипов лимитов (0 остаётся 0, без подстановки дефолта стопа 0.7). */
export function formatPoolChipPct(pct: number): string {
  if (!Number.isFinite(pct) || pct < 0) return "0";
  const rounded = Math.round(pct * 100) / 100;
  return String(rounded).replace(/\.?0+$/, "");
}

export function stakeSliderMarks(maxPct: number): number[] {
  return evenSliderMarks(Math.max(0, Math.min(100, maxPct)), 0, 4);
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
