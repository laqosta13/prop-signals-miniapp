"""Оригинальные иконки монет (CoinGecko) с кэшем по символу."""

from __future__ import annotations

import logging
import re

import httpx

logger = logging.getLogger(__name__)

_COINGECKO = "https://api.coingecko.com/api/v3"
_TIMEOUT = 12.0
_ICON_CACHE: dict[str, str] = {}

# Точный id CoinGecko, если по symbol search промахивается.
_CG_ID_BY_BASE: dict[str, str] = {
    "BTC": "bitcoin",
    "ETH": "ethereum",
    "TON": "the-open-network",
    "SOL": "solana",
    "DOGE": "dogecoin",
    "PEPE": "pepe",
    "BONK": "bonk",
    "WIF": "dogwifcoin",
    "XRP": "ripple",
    "BNB": "binancecoin",
    "ADA": "cardano",
    "AVAX": "avalanche-2",
    "LINK": "chainlink",
    "DOT": "polkadot",
    "MATIC": "matic-network",
    "POL": "polygon-ecosystem-token",
    "LTC": "litecoin",
    "TRX": "tron",
    "SHIB": "shiba-inu",
    "NEAR": "near",
    "APT": "aptos",
    "SUI": "sui",
    "ARB": "arbitrum",
    "OP": "optimism",
    "ATOM": "cosmos",
    "FIL": "filecoin",
    "UNI": "uniswap",
    "AAVE": "aave",
    "INJ": "injective-protocol",
    "TIA": "celestia",
    "SEI": "sei-network",
    "FET": "fetch-ai",
    "RENDER": "render-token",
    "WLD": "worldcoin-wld",
    "STX": "blockstack",
    "IMX": "immutable-x",
    "RUNE": "thorchain",
    "FTM": "fantom",
    "SAND": "the-sandbox",
    "MANA": "decentraland",
    "GALA": "gala",
    "ENA": "ethena",
    "ONDO": "ondo-finance",
    "NOT": "notcoin",
    "JUP": "jupiter-exchange-solana",
    "PYTH": "pyth-network",
    "STRK": "starknet",
    "BLUR": "blur",
    "CRV": "curve-dao-token",
    "LDO": "lido-dao",
    "MKR": "maker",
    "ETC": "ethereum-classic",
    "BCH": "bitcoin-cash",
    "XLM": "stellar",
    "HBAR": "hedera-hashgraph",
    "VET": "vechain",
    "ICP": "internet-computer",
    "ALGO": "algorand",
    "FLOW": "flow",
    "EGLD": "multiversx-egld",
    "AXS": "axie-infinity",
    "APE": "apecoin",
    "1000SATS": "sats-ordinals",
}


def symbol_base(symbol: str) -> str:
    base = (
        symbol.strip()
        .upper()
        .replace("USDT", "")
        .replace("USD", "")
        .replace("PERP", "")
    )
    if m := re.fullmatch(r"1000(.+)", base):
        base = m.group(1)
    return base or symbol.strip().upper()


def _spot_hq_fallback(base: str) -> str:
    slug = base.lower()
    return f"https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/{slug}.png"


async def warmup_coin_icon_cache() -> None:
    """Предзагрузка топ-монет с CoinGecko (официальные logo URL)."""
    added = 0
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            for page in range(1, 5):
                r = await client.get(
                    f"{_COINGECKO}/coins/markets",
                    params={
                        "vs_currency": "usd",
                        "order": "market_cap_desc",
                        "per_page": 250,
                        "page": page,
                        "sparkline": "false",
                    },
                )
                if not r.is_success:
                    logger.warning("CoinGecko markets page=%s: HTTP %s", page, r.status_code)
                    break
                rows = r.json()
                if not isinstance(rows, list) or not rows:
                    break
                for row in rows:
                    sym = str(row.get("symbol") or "").upper()
                    image = row.get("image")
                    if sym and isinstance(image, str) and image.startswith("http"):
                        if sym not in _ICON_CACHE:
                            _ICON_CACHE[sym] = image
                            added += 1
            for base, cg_id in _CG_ID_BY_BASE.items():
                if base in _ICON_CACHE:
                    continue
                url = await _fetch_coingecko_image(client=client, cg_id=cg_id)
                if url:
                    _ICON_CACHE[base] = url
                    added += 1
    except httpx.HTTPError as e:
        logger.warning("CoinGecko warmup failed: %s", e)
    if added:
        logger.info("Coin icons: cached %s symbols (%s total)", added, len(_ICON_CACHE))


async def _fetch_coingecko_image(*, client: httpx.AsyncClient | None, cg_id: str) -> str | None:
    own_client = client is None
    if own_client:
        client = httpx.AsyncClient(timeout=_TIMEOUT)
    try:
        r = await client.get(f"{_COINGECKO}/coins/{cg_id}", params={"localization": "false"})
        if not r.is_success:
            return None
        data = r.json()
        image = data.get("image") if isinstance(data, dict) else None
        if isinstance(image, dict):
            for key in ("small", "thumb", "large"):
                val = image.get(key)
                if isinstance(val, str) and val.startswith("http"):
                    return val
        return None
    finally:
        if own_client:
            await client.aclose()


async def _search_coingecko(base: str) -> str | None:
    query = base.lower()
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            r = await client.get(f"{_COINGECKO}/search", params={"query": query})
            if not r.is_success:
                return None
            data = r.json()
            coins = data.get("coins") if isinstance(data, dict) else None
            if not isinstance(coins, list):
                return None
            exact = [c for c in coins if str(c.get("symbol", "")).upper() == base]
            pool = exact or coins
            best = min(pool, key=lambda c: int(c.get("market_cap_rank") or 999_999))
            for key in ("large", "thumb", "small"):
                url = best.get(key)
                if isinstance(url, str) and url.startswith("http"):
                    return url
            cg_id = best.get("id")
            if isinstance(cg_id, str) and cg_id:
                return await _fetch_coingecko_image(client=client, cg_id=cg_id)
    except httpx.HTTPError as e:
        logger.warning("CoinGecko search %s: %s", base, e)
    return None


async def resolve_coin_icon_url(symbol: str) -> str | None:
    base = symbol_base(symbol)
    if not base:
        return None
    cached = _ICON_CACHE.get(base)
    if cached:
        return cached

    cg_id = _CG_ID_BY_BASE.get(base)
    if cg_id:
        url = await _fetch_coingecko_image(client=None, cg_id=cg_id)
        if url:
            _ICON_CACHE[base] = url
            return url

    url = await _search_coingecko(base)
    if url:
        _ICON_CACHE[base] = url
        return url

    fallback = _spot_hq_fallback(base)
    _ICON_CACHE[base] = fallback
    return fallback
