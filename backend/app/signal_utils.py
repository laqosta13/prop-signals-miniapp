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


def effective_entry_price(
    entry_low: str | None,
    entry_high: str | None,
    published_market_price: float | None = None,
) -> float | None:
    """Цена входа: лимитная зона или снимок рынка при публикации (market-entry)."""
    mid = entry_mid(entry_low, entry_high)
    if mid is not None:
        return mid
    if published_market_price is not None and published_market_price > 0:
        return float(published_market_price)
    return None


def format_level_price_display(price: float) -> str:
    abs_p = abs(price)
    if abs_p >= 1000:
        text = f"{price:.2f}"
    elif abs_p >= 1:
        text = f"{price:.4f}"
    else:
        text = f"{price:.6f}"
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text


def format_signal_entry_display(
    entry_low: str | None,
    entry_high: str | None,
    published_market_price: float | None = None,
) -> str:
    """Строка входа для UI: зона лимита или цена рынка при публикации."""
    low_raw = (entry_low or "").strip()
    high_raw = (entry_high or "").strip()
    lo = parse_price(entry_low)
    hi = parse_price(entry_high)
    if lo is not None and hi is not None and low_raw and high_raw and low_raw != high_raw:
        return f"{format_level_price_display(lo)}–{format_level_price_display(hi)}"
    price = effective_entry_price(entry_low, entry_high, published_market_price)
    if price is not None:
        return format_level_price_display(price)
    return low_raw or high_raw or "—"


def outcome_from_move(move: float) -> str:
    """win/lose по знаку движения цены (0% = win)."""
    return "win" if move >= 0 else "lose"


def price_move_pct(
    entry: float,
    direction: str,
    exit_price: float,
) -> float:
    """Чистый % движения цены вход→выход."""
    if entry <= 0:
        return 0.0
    d = direction.lower()
    if d == "long":
        return round((exit_price - entry) / entry * 100.0, 2)
    if d == "short":
        return round((entry - exit_price) / entry * 100.0, 2)
    return 0.0


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


def entry_triggered(
    price: float,
    direction: str,
    entry_low: str | None,
    entry_high: str | None,
) -> bool:
    """Лимитный вход сработал: цена в зоне или уже прошла уровень входа."""
    if price_in_entry_zone(price, entry_low, entry_high):
        return True
    a = parse_price(entry_low)
    b = parse_price(entry_high)
    if a is None and b is None:
        return True
    lo = min(a, b) if a is not None and b is not None else (a if a is not None else b)
    hi = max(a, b) if a is not None and b is not None else lo
    assert lo is not None and hi is not None
    d = direction.lower()
    # LONG: покупаем на откате — вход сработал, если цена уже на уровне или ниже
    if d == "long":
        return price <= hi
    # SHORT: продаём на росте — вход сработал, если цена уже на уровне или выше
    if d == "short":
        return price >= lo
    return False


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


def compute_signal_points_percent_from_price(entry_price: float, stop_loss: str | None) -> float:
    """points_percent для market-entry: расстояние от цены публикации до стопа."""
    stop = parse_price(stop_loss)
    if entry_price > 0 and stop is not None:
        pct = abs(entry_price - stop) / entry_price * 100.0
        return round(min(max(pct, 0.1), settings.max_signal_points_percent), 2)
    return settings.default_signal_points_percent


def form_bool_flag(raw: str | None) -> bool:
    return raw is not None and raw.strip().lower() in ("1", "true", "yes", "on")


def stored_entry_levels(
    entry_low: str | None,
    entry_high: str | None,
    *,
    market_entry: bool,
) -> tuple[str | None, str | None]:
    """Уровни входа в БД: market_entry — без лимитной зоны (вход по рынку)."""
    if market_entry:
        return None, None
    return entry_low or None, entry_high or None


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


def exit_price_for_outcome(
    outcome: str,
    *,
    stop_loss: str | None,
    take_profits: str | None,
    direction: str,
    market_price: float | None = None,
) -> float | None:
    """Уровень выхода по стопу или первой достигнутой цели (без проскальзывания)."""
    if outcome == "lose":
        return parse_price(stop_loss)
    if outcome != "win":
        return None
    tps = parse_take_profit_levels(take_profits)
    if not tps:
        return parse_price(take_profits)
    d = direction.lower()
    if market_price is not None:
        if d == "long":
            hit = [tp for tp in tps if market_price >= tp]
            if hit:
                return min(hit)
        elif d == "short":
            hit = [tp for tp in tps if market_price <= tp]
            if hit:
                return max(hit)
    if d == "long":
        return min(tps)
    if d == "short":
        return max(tps)
    return tps[0]


def monitor_exit_price(
    outcome: str,
    *,
    direction: str,
    stop_loss: str | None,
    take_profits: str | None,
    market_price: float,
) -> float:
    """Цена закрытия монитором: ровно стоп/цель, даже если котировка уже прошла уровень."""
    level = exit_price_for_outcome(
        outcome,
        stop_loss=stop_loss,
        take_profits=take_profits,
        direction=direction,
        market_price=market_price,
    )
    if level is not None:
        return level
    return market_price


def trade_move_pct(
    entry_low: str | None,
    entry_high: str | None,
    direction: str,
    outcome: str,
    *,
    exit_price: float | None = None,
    stop_loss: str | None = None,
    take_profits: str | None = None,
    published_market_price: float | None = None,
) -> float:
    """% изменения цены от входа до выхода (положительный = профит для направления)."""
    entry = effective_entry_price(entry_low, entry_high, published_market_price)
    if exit_price is None:
        exit_price = exit_price_for_outcome(
            outcome, stop_loss=stop_loss, take_profits=take_profits, direction=direction
        )
    if entry is None or exit_price is None:
        return 0.0
    return price_move_pct(entry, direction, exit_price)
