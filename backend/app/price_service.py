"""Получение текущих цен для авто-закрытия сигналов (бесплатные API)."""

from __future__ import annotations

import logging

import httpx

logger = logging.getLogger(__name__)

_cache: dict[str, float] = {}


def normalize_symbol(symbol: str) -> str:
    return symbol.upper().replace("/", "").replace("-", "").strip()


def _crypto_usdt_pair(sym: str) -> str | None:
    s = normalize_symbol(sym)
    if s.endswith("USDT"):
        return s
    if s.endswith("USD") and len(s) > 3:
        return s[:-3] + "USDT"
    return None


async def _get_json(url: str) -> dict | list | None:
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            r = await client.get(url)
            if r.status_code != 200:
                logger.warning("price HTTP %s for %s", r.status_code, url[:80])
                return None
            return r.json()
    except Exception as e:
        logger.warning("price fetch error %s: %s", url[:60], e)
        return None


async def _fetch_binance(pair: str) -> float | None:
    data = await _get_json(f"https://api.binance.com/api/v3/ticker/price?symbol={pair}")
    if isinstance(data, dict) and data.get("price"):
        return float(data["price"])
    return None


async def _fetch_binance_us(pair: str) -> float | None:
    data = await _get_json(f"https://api.binance.us/api/v3/ticker/price?symbol={pair}")
    if isinstance(data, dict) and data.get("price"):
        return float(data["price"])
    return None


async def _fetch_bybit(pair: str) -> float | None:
    data = await _get_json(f"https://api.bybit.com/v5/market/tickers?category=linear&symbol={pair}")
    if not isinstance(data, dict):
        return None
    items = (data.get("result") or {}).get("list") or []
    if items and items[0].get("lastPrice"):
        return float(items[0]["lastPrice"])
    return None


async def _fetch_frankfurter(base: str, quote: str) -> float | None:
    data = await _get_json(f"https://api.frankfurter.app/latest?from={base}&to={quote}")
    if not isinstance(data, dict):
        return None
    rates = data.get("rates") or {}
    val = rates.get(quote)
    return float(val) if val is not None else None


async def _fetch_gold_usd() -> float | None:
    data = await _get_json("https://api.gold-api.com/price/XAU")
    if not isinstance(data, dict):
        return None
    price = data.get("price") or data.get("value")
    return float(price) if price is not None else None


async def _fetch_crypto_price(pair: str) -> float | None:
    for fn in (_fetch_binance, _fetch_bybit, _fetch_binance_us):
        price = await fn(pair)
        if price is not None:
            return price
    return None


async def fetch_price(symbol: str) -> float | None:
    sym = normalize_symbol(symbol)
    if sym in _cache:
        return _cache[sym]

    price: float | None = None
    pair = _crypto_usdt_pair(sym)
    if pair:
        price = await _fetch_crypto_price(pair)
    elif sym in ("XAUUSD", "GOLD", "XAU"):
        price = await _fetch_gold_usd()
    elif len(sym) == 6 and sym.isalpha():
        price = await _fetch_frankfurter(sym[:3], sym[3:])

    if price is not None:
        _cache[sym] = price
    else:
        logger.warning("Не удалось получить цену для %s (pair=%s)", sym, pair)
    return price


def clear_price_cache() -> None:
    _cache.clear()
