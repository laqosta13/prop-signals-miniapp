import { fetchMarketPrice } from "../api";
import { bybitSymbol } from "./signalChartLevels";

export async function fetchBybitLastPrice(symbol: string): Promise<number | null> {
  const pair = bybitSymbol(symbol);
  if (!pair) return null;
  try {
    const { price } = await fetchMarketPrice(pair);
    return Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}
