import { bybitSymbol } from "./signalChartLevels";

export async function fetchBybitLastPrice(symbol: string): Promise<number | null> {
  const pair = bybitSymbol(symbol);
  if (!pair) return null;
  try {
    const res = await fetch(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${pair}`);
    if (!res.ok) return null;
    const body = (await res.json()) as {
      retCode?: number;
      result?: { list?: { lastPrice?: string }[] };
    };
    if (body.retCode !== 0) return null;
    const raw = body.result?.list?.[0]?.lastPrice;
    const price = raw != null ? Number(raw) : NaN;
    return Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}
