"""Получение текущих цен для авто-закрытия сигналов (бесплатные API)."""

from __future__ import annotations

import logging

import httpx

logger = logging.getLogger(__name__)

# Кэш цен на один цикл мониторинга
_cache: dict[str, float] = {}


def _normalize_symbol(symbol: str) -> str:
    return symbol.upper().replace("/", "").replace("-", "").strip()


async def _fetch_binance(symbol: str) -> float | None:
    pair = symbol if symbol.endswith("USDT") else f"{symbol.removesuffix('USD')}USDT"
    if pair == "USDT":
        return None
    url = f"https://api.binance.com/api/v3/ticker/price?symbol={pair}"
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(url)
        if r.status_code != 200:
            return None
        data = r.json()
        return float(data["price"])


async def _fetch_frankfurter(base: str, quote: str) -> float | None:
    """Курс: сколько quote за 1 base (например EURUSD)."""
    url = f"https://api.frankfurter.app/latest?from={base}&to={quote}"
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(url)
        if r.status_code != 200:
            return None
        rates = r.json().get("rates") or {}
        val = rates.get(quote)
        return float(val) if val is not None else None


async def _fetch_gold_usd() -> float | None:
    """Примерная цена XAU/USD (публичный JSON)."""
    url = "https://api.gold-api.com/price/XAU"
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(url)
        if r.status_code != 200:
            return None
        data = r.json()
        price = data.get("price") or data.get("value")
        return float(price) if price is not None else None


async def fetch_price(symbol: str) -> float | None:
    sym = _normalize_symbol(symbol)
    if sym in _cache:
        return _cache[sym]

    price: float | None = None

    # Крипта (BTCUSD → BTCUSDT)
    if sym.endswith("USDT"):
        price = await _fetch_binance(sym)
    elif sym.endswith("USD") and len(sym) > 3:
        price = await _fetch_binance(sym[:-3] + "USDT")

    # Золото
    elif sym in ("XAUUSD", "GOLD", "XAU"):
        price = await _fetch_gold_usd()

    # Форекс 6 букв: EURUSD
    elif len(sym) == 6 and sym.isalpha():
        base, quote = sym[:3], sym[3:]
        price = await _fetch_frankfurter(base, quote)

    if price is not None:
        _cache[sym] = price
    else:
        logger.warning("Не удалось получить цену для %s", sym)
    return price


def clear_price_cache() -> None:
    _cache.clear()
