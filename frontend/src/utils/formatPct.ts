/** Единый формат % для слайдеров, чипов и подписей (0 → «0»). */
export function formatPct(pct: number): string {
  if (!Number.isFinite(pct) || pct < 0) return "0";
  const rounded = Math.round(pct * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function roundPct(pct: number): number {
  return Math.round(pct * 100) / 100;
}
