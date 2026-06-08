/**
 * Пул суммы входа % для копирующих volnovoi.
 * 100% = сумма долей входа (risk_percent) по всем активным сигналам админов,
 * без веса по балансу трекера (20% + 20% у двух трейдеров → занято 40%).
 */

import { formatPct } from "./formatPct";
import { evenSliderMarks } from "./sliderMarks";

export const STAKE_POOL_TOTAL_PCT = 100;

export function formatPoolChipPct(pct: number): string {
  return formatPct(pct);
}

export function stakeSliderMarks(maxPct: number): number[] {
  return evenSliderMarks(Math.max(0, Math.min(100, maxPct)), 0, 4);
}

export function stakePoolBlockedMessage(
  maxStakePct: number,
  poolRemainingPct: number,
  opts?: { rankEntryLocked?: boolean; rankMaxStakePct?: number },
): string {
  if (opts?.rankEntryLocked) {
    const cap = opts.rankMaxStakePct ?? 0;
    return `Активная сделка на полном лимите входа (${formatPoolChipPct(cap)}) по рангу — дождитесь закрытия`;
  }
  if (maxStakePct <= 0) {
    if (poolRemainingPct <= 0) return "Пул входа занят (100%)";
    return "Вход недоступен — лимит ранга или пул";
  }
  return "";
}
