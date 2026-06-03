"""Цены: Bybit USDT perpetual (linear). Вход/выход — по котировке Bybit."""

from __future__ import annotations

import asyncio
import logging
import math
import time
from dataclasses import dataclass

import httpx

from app.config import settings
from app.signal_utils import entry_triggered, evaluate_signal

logger = logging.getLogger(__name__)

_cache: dict[str, list[PriceQuote]] = {}
_linear_symbols_cache: list[str] | None = None
_linear_symbols_cache_at: float = 0.0
_LINEAR_SYMBOLS_CACHE_TTL = 3600.0
_LINEAR_SYMBOLS_POPULAR = (
    "BTCUSDT",
    "ETHUSDT",
    "SOLUSDT",
    "BNBUSDT",
    "XRPUSDT",
    "DOGEUSDT",
    "ADAUSDT",
    "AVAXUSDT",
)
_price_httpx: httpx.AsyncClient | None = None
_PRICE_FETCH_RETRIES = 3
_PRICE_FETCH_RETRY_DELAY = 0.5


@dataclass(frozen=True)
class PriceQuote:
    source: str
    price: float


def normalize_symbol(symbol: str) -> str:
    return symbol.upper().replace("/", "").replace("-", "").strip()


def bybit_linear_pair(symbol: str) -> str | None:
    """Пара USDT perpetual на Bybit (linear)."""
    return _crypto_usdt_pair(symbol)


def _crypto_usdt_pair(sym: str) -> str | None:
    """Пара для Bybit linear (USDT perpetual)."""
    s = normalize_symbol(sym)
    if not s:
        return None
    if s.endswith("USDT"):
        return s
    if s.endswith("USD") and len(s) > 3:
        return s[:-3] + "USDT"
    if 2 <= len(s) <= 10 and s.isalnum() and not (len(s) == 6 and s.isalpha()):
        return f"{s}USDT"
    return None


def _valid_price(value: float | None) -> float | None:
    if value is None:
        return None
    if not math.isfinite(value) or value <= 0:
        return None
    return value


def _get_http_client() -> httpx.AsyncClient:
    global _price_httpx
    if _price_httpx is None or _price_httpx.is_closed:
        _price_httpx = httpx.AsyncClient(timeout=settings.price_http_timeout_seconds)
    return _price_httpx


async def _get_json(url: str) -> dict | list | None:
    for attempt in range(1, _PRICE_FETCH_RETRIES + 1):
        try:
            r = await _get_http_client().get(url)
            if r.status_code != 200:
                logger.warning("price HTTP %s for %s", r.status_code, url[:96])
                return None
            return r.json()
        except Exception as e:
            if attempt >= _PRICE_FETCH_RETRIES:
                logger.warning(
                    "price fetch error %s after %s attempts: %s: %s",
                    url[:72],
                    attempt,
                    type(e).__name__,
                    e or "(no message)",
                )
                return None
            logger.info(
                "price fetch retry %s/%s %s: %s: %s",
                attempt,
                _PRICE_FETCH_RETRIES,
                url[:72],
                type(e).__name__,
                e or "(no message)",
            )
            await asyncio.sleep(_PRICE_FETCH_RETRY_DELAY * attempt)
    return None


def _parse_bybit_ticker(data: dict | list | None) -> float | None:
    if not isinstance(data, dict):
        return None
    items = (data.get("result") or {}).get("list") or []
    if items and items[0].get("lastPrice") is not None:
        return _valid_price(float(items[0]["lastPrice"]))
    return None


async def _fetch_bybit_linear(pair: str) -> PriceQuote | None:
    data = await _get_json(f"https://api.bybit.com/v5/market/tickers?category=linear&symbol={pair}")
    price = _parse_bybit_ticker(data)
    return PriceQuote("bybit_perp", price) if price is not None else None


async def _fetch_frankfurter(base: str, quote: str) -> float | None:
    data = await _get_json(f"https://api.frankfurter.app/latest?from={base}&to={quote}")
    if not isinstance(data, dict):
        return None
    rates = data.get("rates") or {}
    val = rates.get(quote)
    return _valid_price(float(val)) if val is not None else None


async def _fetch_gold_usd() -> float | None:
    data = await _get_json("https://api.gold-api.com/price/XAU")
    if not isinstance(data, dict):
        return None
    raw = data.get("price") or data.get("value")
    return _valid_price(float(raw)) if raw is not None else None


async def fetch_bybit_linear_symbols() -> list[str]:
    """USDT perpetual (linear) на Bybit в статусе Trading."""
    global _linear_symbols_cache, _linear_symbols_cache_at
    now = time.monotonic()
    if _linear_symbols_cache is not None and now - _linear_symbols_cache_at < _LINEAR_SYMBOLS_CACHE_TTL:
        return _linear_symbols_cache

    symbols: list[str] = []
    cursor: str | None = None
    for _ in range(20):
        url = "https://api.bybit.com/v5/market/instruments-info?category=linear&limit=1000"
        if cursor:
            url += f"&cursor={cursor}"
        data = await _get_json(url)
        if not isinstance(data, dict) or data.get("retCode") != 0:
            break
        result = data.get("result") or {}
        for item in result.get("list") or []:
            if not isinstance(item, dict):
                continue
            if item.get("status") != "Trading":
                continue
            sym = item.get("symbol")
            if isinstance(sym, str) and sym.endswith("USDT"):
                symbols.append(sym)
        cursor = result.get("nextPageCursor") or None
        if not cursor:
            break

    out = sorted(set(symbols))
    if out:
        _linear_symbols_cache = out
        _linear_symbols_cache_at = now
    return out if out else (_linear_symbols_cache or [])


def filter_bybit_linear_symbols(symbols: list[str], query: str, *, limit: int = 16) -> list[str]:
    q = normalize_symbol(query)
    if len(q) < 1:
        return []
    sym_set = set(symbols)
    popular = [p for p in _LINEAR_SYMBOLS_POPULAR if p.startswith(q) and p in sym_set]
    rest = [s for s in symbols if s.startswith(q) and s not in popular]
    return (popular + rest)[:limit]


async def fetch_bybit_perp_quote(symbol: str) -> PriceQuote | None:
    """Котировка Bybit USDT perpetual (category=linear)."""
    pair = _crypto_usdt_pair(symbol)
    if not pair:
        return None
    return await _fetch_bybit_linear(pair)


def first_entry_quote(
    quotes: list[PriceQuote],
    direction: str,
    entry_low: str | None,
    entry_high: str | None,
) -> PriceQuote | None:
    for q in quotes:
        if entry_triggered(q.price, direction, entry_low, entry_high):
            return q
    return None


def first_outcome_quote(
    quotes: list[PriceQuote],
    direction: str,
    stop_loss: str | None,
    take_profits: str | None,
) -> tuple[str, PriceQuote] | None:
    win: PriceQuote | None = None
    for q in quotes:
        outcome = evaluate_signal(q.price, direction, stop_loss, take_profits)
        if outcome == "lose":
            return "lose", q
        if outcome == "win" and win is None:
            win = q
    if win is not None:
        return "win", win
    return None


async def fetch_market_quotes(symbol: str) -> list[PriceQuote]:
    sym = normalize_symbol(symbol)
    if sym in _cache:
        return _cache[sym]

    quotes: list[PriceQuote] = []
    pair = _crypto_usdt_pair(sym)
    if pair:
        q = await fetch_bybit_perp_quote(sym)
        quotes = [q] if q is not None else []
    elif sym in ("XAUUSD", "GOLD", "XAU"):
        p = await _fetch_gold_usd()
        if p is not None:
            quotes = [PriceQuote("gold_api", p)]
    elif len(sym) == 6 and sym.isalpha():
        p = await _fetch_frankfurter(sym[:3], sym[3:])
        if p is not None:
            quotes = [PriceQuote("frankfurter", p)]

    if quotes:
        _cache[sym] = quotes
    else:
        logger.warning("Не удалось получить цены для %s (pair=%s)", sym, pair)
    return quotes


async def fetch_price(symbol: str) -> float | None:
    q = await fetch_bybit_perp_quote(symbol)
    if q is not None:
        return q.price
    quotes = await fetch_market_quotes(symbol)
    if not quotes:
        return None
    return quotes[0].price


def clear_price_cache() -> None:
    _cache.clear()
