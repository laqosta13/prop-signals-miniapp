"""Парсинг сигналов из текста постов Telegram-каналов."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass

from app.signal_utils import parse_price, parse_take_profit_levels


@dataclass
class ParsedChannelSignal:
    symbol: str
    direction: str
    entry_low: str
    entry_high: str
    stop_loss: str
    take_profits: str


_SYMBOL_RE = re.compile(
    r"(?:#|\$)?([A-Z]{2,10}(?:USDT|USD|PERP)?)\b",
    re.IGNORECASE,
)
_LONG_RE = re.compile(r"\b(long|лонг|buy|покупка)\b", re.IGNORECASE)
_SHORT_RE = re.compile(r"\b(short|шорт|sell|продажа)\b", re.IGNORECASE)

_ENTRY_PATTERNS = (
    r"(?:вход|entry|ent(?:ry)?|buy\s*zone|зона\s*входа)\s*[:\-]?\s*([\d\s.,\-–—]+)",
    r"(?:вход|entry)\s+([\d\s.,\-–—]+)",
)
_STOP_PATTERNS = (
    r"(?:стоп|stop|sl|s/l|stop\s*loss)\s*[:\-]?\s*([\d\s.,]+)",
)
_TP_PATTERNS = (
    r"(?:цель|цели|target|tp|t/p|take\s*profit|take\s*profits)\s*[:\-]?\s*([\d\s.,;]+)",
)


def _normalize_symbol(raw: str) -> str:
    sym = raw.upper().strip().lstrip("#$")
    if sym.endswith("USDT") or sym.endswith("USD") or sym.endswith("PERP"):
        return sym.replace("PERP", "USDT") if sym.endswith("PERP") else sym
    return f"{sym}USDT"


def _extract_price(raw: str | None) -> str | None:
    if not raw:
        return None
    cleaned = raw.strip().replace("–", "-").replace("—", "-")
    parts = re.split(r"\s*-\s*", cleaned)
    if len(parts) == 2:
        lo = parse_price(parts[0])
        hi = parse_price(parts[1])
        if lo is not None and hi is not None:
            return f"{min(lo, hi)}", f"{max(lo, hi)}"
    p = parse_price(cleaned)
    if p is None:
        return None
    s = str(p)
    return s, s


def _first_match(patterns: tuple[str, ...], text: str) -> str | None:
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            return m.group(1).strip()
    return None


def parse_channel_signal(text: str | None) -> ParsedChannelSignal | None:
    if not text or not text.strip():
        return None
    body = text.strip()

    sym_match = _SYMBOL_RE.search(body)
    if not sym_match:
        return None
    symbol = _normalize_symbol(sym_match.group(1))

    if _LONG_RE.search(body):
        direction = "long"
    elif _SHORT_RE.search(body):
        direction = "short"
    else:
        return None

    entry_raw = _first_match(_ENTRY_PATTERNS, body)
    stop_raw = _first_match(_STOP_PATTERNS, body)
    tp_raw = _first_match(_TP_PATTERNS, body)
    if not entry_raw or not stop_raw or not tp_raw:
        return None

    entry = _extract_price(entry_raw)
    stop = parse_price(stop_raw)
    targets = parse_take_profit_levels(tp_raw)
    if entry is None or stop is None or not targets:
        return None

    entry_low, entry_high = entry
    return ParsedChannelSignal(
        symbol=symbol,
        direction=direction,
        entry_low=entry_low,
        entry_high=entry_high,
        stop_loss=str(stop),
        take_profits=json.dumps(targets),
    )
