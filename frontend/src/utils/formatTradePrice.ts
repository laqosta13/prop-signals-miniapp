/** Цена выхода / уровня для списка сделок. */
export function formatTradePrice(price: number | null | undefined): string {
  if (price == null || !Number.isFinite(price)) return "—";
  const abs = Math.abs(price);
  if (abs >= 1000) return price.toFixed(2);
  if (abs >= 1) return price.toFixed(4).replace(/\.?0+$/, "");
  return price.toFixed(6).replace(/\.?0+$/, "");
}
