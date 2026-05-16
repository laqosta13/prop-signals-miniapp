from __future__ import annotations

import json
import re

from app.config import settings


def parse_price(raw: str | None) -> float | None:
    if not raw:
        return None
    cleaned = raw.strip().replace(",", ".")
    cleaned = re.sub(r"[^\d.\-]", "", cleaned)
    if not cleaned:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def parse_take_profit_levels(raw: str | None) -> list[float]:
    if not raw:
        return []
    trimmed = raw.strip()
    if trimmed.startswith("["):
        try:
            data = json.loads(trimmed)
            if isinstance(data, list):
                return [p for x in data if (p := parse_price(str(x))) is not None]
        except json.JSONDecodeError:
            pass
    levels: list[float] = []
    for part in re.split(r"[,;]+", trimmed):
        p = parse_price(part)
        if p is not None:
            levels.append(p)
    return levels


def entry_mid(entry_low: str | None, entry_high: str | None) -> float | None:
    low = parse_price(entry_low)
    high = parse_price(entry_high)
    if low is not None and high is not None:
        return (low + high) / 2
    return low if low is not None else high


def compute_signal_points_percent(
    entry_low: str | None,
    entry_high: str | None,
    stop_loss: str | None,
) -> float:
    """Процент рейтинга за сигнал: расстояние вход→стоп в % от цены входа."""
    entry = entry_mid(entry_low, entry_high)
    stop = parse_price(stop_loss)
    if entry and stop and entry > 0:
        pct = abs(entry - stop) / entry * 100.0
        return round(min(max(pct, 0.1), settings.max_signal_points_percent), 2)
    return settings.default_signal_points_percent


def evaluate_signal(price: float, direction: str, stop_loss: str | None, take_profits: str | None) -> str | None:
    """Возвращает 'win', 'lose' или None если уровни не достигнуты."""
    stop = parse_price(stop_loss)
    tps = parse_take_profit_levels(take_profits)
    d = direction.lower()

    if d == "long":
        if stop is not None and price <= stop:
            return "lose"
        if tps and any(price >= tp for tp in tps):
            return "win"
    elif d == "short":
        if stop is not None and price >= stop:
            return "lose"
        if tps and any(price <= tp for tp in tps):
            return "win"
    return None
