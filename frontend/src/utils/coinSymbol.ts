/** Базовый актив из пары Bybit (BTCUSDT → BTC, 1000PEPEUSDT → PEPE). */
export function symbolBase(symbol: string): string {
  let base = symbol
    .trim()
    .toUpperCase()
    .replace(/USDT$/i, "")
    .replace(/USD$/i, "")
    .replace(/PERP$/i, "");
  if (/^1000(.+)$/.test(base)) base = base.slice(4);
  return base || symbol.trim().toUpperCase();
}

const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") ||
  (import.meta.env.DEV ? "/api" : "");

export function coinIconSlug(symbol: string): string {
  return symbolBase(symbol).toLowerCase();
}

/** Оригинальные logo: бэкенд (CoinGecko) → брендовые SVG → spothq. */
export function coinIconUrls(symbol: string): string[] {
  const slug = coinIconSlug(symbol);
  const encoded = encodeURIComponent(symbol.trim());
  const urls: string[] = [];
  if (API_BASE) {
    urls.push(`${API_BASE}/signals/coin-icon?symbol=${encoded}`);
  }
  urls.push(
    `https://logo.svgcdn.com/token-branded/${slug}.svg`,
    `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/${slug}.png`,
    `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/${slug}.svg`,
  );
  return urls;
}

export function symbolHue(symbol: string): number {
  let h = 0;
  const s = symbolBase(symbol);
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}
