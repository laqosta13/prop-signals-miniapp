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


def entry_zone_defined(entry_low: str | None, entry_high: str | None) -> bool:
    return parse_price(entry_low) is not None or parse_price(entry_high) is not None


def price_in_entry_zone(price: float, entry_low: str | None, entry_high: str | None) -> bool:
    """Цена в зоне лимитного входа (включительно). Без зоны — считаем вход сразу состоявшимся."""
    a = parse_price(entry_low)
    b = parse_price(entry_high)
    if a is None and b is None:
        return True
    if a is None or b is None:
        v = a if a is not None else b
        assert v is not None
        return abs(price - v) / max(abs(v), 1e-12) <= 0.0005
    lo, hi = min(a, b), max(a, b)
    return lo <= price <= hi


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


def signal_awaiting_entry(signal) -> bool:
    """Сигнал ещё не в работе — можно менять уровни и удалить."""
    if signal.status != "active":
        return False
    if signal.entry_filled_at is not None:
        return False
    return entry_zone_defined(signal.entry_low, signal.entry_high)


def signal_in_trade(signal) -> bool:
    """Сигнал в работе (вход сработал), ещё не закрыт."""
    if signal.status != "active":
        return False
    if signal.entry_filled_at is not None:
        return True
    return not entry_zone_defined(signal.entry_low, signal.entry_high)


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
