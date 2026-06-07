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

const ICON_SLUG_ALIASES: Record<string, string> = {
  pepe: "pepe",
  bonk: "bonk",
  floki: "floki",
  lunc: "luna",
  wif: "wif",
};

export function coinIconSlug(symbol: string): string {
  const base = symbolBase(symbol).toLowerCase();
  return ICON_SLUG_ALIASES[base] ?? base;
}

export function coinIconUrls(symbol: string): string[] {
  const slug = coinIconSlug(symbol);
  return [
    `https://assets.coincap.io/assets/icons/${slug}@2x.png`,
    `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/${slug}.png`,
    `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/${slug}.svg`,
  ];
}

export function symbolHue(symbol: string): number {
  let h = 0;
  const s = symbolBase(symbol);
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}
