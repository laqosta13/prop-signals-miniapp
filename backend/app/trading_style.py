"""Стиль volnovoi — сленговый профиль торговли по закрытым сигналам."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from statistics import median

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Signal, Trader
from app.signal_stake_pool import rank_max_stake_pct
from app.schemas import VolnovoiStyleRead
from app.signal_utils import (
    compute_signal_points_percent,
    effective_entry_price,
    entry_zone_defined,
    parse_take_profit_levels,
    trade_move_pct,
)
from app.trader_stats import closed_signal_move_pct, signal_leverage, signal_resolved_exit_price

MIN_SAMPLES = 5
MAX_SAMPLES = 20
WINDOW_DAYS = 60

_ARCHETYPE_COPY: dict[str, tuple[str, str]] = {
    "forming": (
        "Стиль качается",
        "Мало закрытых сделок — профиль появится после пары недель в ленте.",
    ),
    "structurer": (
        "Структурщик",
        "Входит по плану и дожимает до стопа или цели. Редко жмёт «закрыть по рынку» — спокойный регламент.",
    ),
    "diamond": (
        "Алмазный",
        "Алмазные руки: сидит долго и часто забирает полную цель. Не сливает на первом плюсе.",
    ),
    "fixer": (
        "Фиксатор",
        "Берёт профит раньше плана — не ждёт 1:3, фиксирует по факту. Аккуратный, без жадности до цели.",
    ),
    "paper": (
        "Бумажный",
        "Бумажные руки: быстро забирает плюс, не держит. Короткие сделки, ранний выход.",
    ),
    "scalp": (
        "Скальпик",
        "Короткие заходы — вошёл, вышел, без многочасовых кемпов в позиции.",
    ),
    "sniper": (
        "Снайпер",
        "Редко стреляет, но метко: мало сделок, зато по уровням и без суеты.",
    ),
    "grinder": (
        "Гриндер",
        "Молотит объём — много сетапов в неделю, постоянно в игре.",
    ),
    "hyperactive": (
        "Шило",
        "Шило в одном месте: куча сделок и частые ручные выходы по рынку.",
    ),
    "patient": (
        "Терпила",
        "Может сидеть в позиции сутками — не дёргается, ждёт сценарий.",
    ),
    "reactive": (
        "Реактивщик",
        "Часто закрывает по рынку, а не по уровню — торгует на ощущении в моменте.",
    ),
    "fomo": (
        "Фомошник",
        "Много входов и частые market close — похоже на погоню за движением.",
    ),
    "by_the_book": (
        "По уставу",
        "Дисциплина ММ: % входа и плечо в рамках ранга, без лудомании.",
    ),
    "vibe": (
        "На вайбе",
        "Смешанный стиль: план есть, но исход часто решает рынок, не только уровни.",
    ),
}


@dataclass
class _Metrics:
    sample_size: int
    market_rate: float
    target_rate: float
    stop_rate: float
    median_hold_min: float
    trades_per_week: float
    plan_capture_median: float | None
    limit_entry_rate: float
    leverage_rate: float
    stake_discipline: float


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _closed_signals(
    db: Session,
    author_id: int,
    *,
    cult_candidate: bool,
) -> list[Signal]:
    since = _now() - timedelta(days=WINDOW_DAYS)
    rows = db.scalars(
        select(Signal)
        .where(
            Signal.author_telegram_id == author_id,
            Signal.status.in_(("win", "lose")),
            Signal.is_cult_candidate.is_(cult_candidate),
            Signal.closed_at.isnot(None),
            Signal.closed_at >= since,
        )
        .order_by(Signal.closed_at.desc())
        .limit(MAX_SAMPLES)
    ).all()
    return list(rows)


def _planned_rr(signal: Signal) -> float | None:
    stop_pct = compute_signal_points_percent(signal.entry_low, signal.entry_high, signal.stop_loss)
    if stop_pct <= 0:
        return None
    entry = effective_entry_price(
        signal.entry_low,
        signal.entry_high,
        signal.published_market_price,
    )
    tps = parse_take_profit_levels(signal.take_profits)
    if entry is None or not tps:
        return None
    d = (signal.direction or "").lower()
    tp = min(tps) if d == "long" else max(tps)
    if d == "long":
        reward_pct = (tp - entry) / entry * 100.0
    elif d == "short":
        reward_pct = (entry - tp) / entry * 100.0
    else:
        return None
    if reward_pct <= 0:
        return None
    return round(reward_pct / stop_pct, 2)


def _realized_r(signal: Signal) -> float | None:
    stop_pct = compute_signal_points_percent(signal.entry_low, signal.entry_high, signal.stop_loss)
    if stop_pct <= 0:
        return None
    exit_px = signal_resolved_exit_price(signal)
    move = trade_move_pct(
        signal.entry_low,
        signal.entry_high,
        signal.direction,
        signal.status,
        exit_price=exit_px,
        stop_loss=signal.stop_loss,
        take_profits=signal.take_profits,
        published_market_price=signal.published_market_price,
    )
    if move == 0 and signal.status in ("win", "lose"):
        move = closed_signal_move_pct(signal)
    return round(abs(move) / stop_pct, 2)


def _hold_minutes(signal: Signal) -> float | None:
    if signal.closed_at is None:
        return None
    start = signal.entry_filled_at or signal.created_at
    if start is None:
        return None
    closed = signal.closed_at
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if closed.tzinfo is None:
        closed = closed.replace(tzinfo=timezone.utc)
    return max(0.0, (closed - start).total_seconds() / 60.0)


def _collect_metrics(db: Session, author_id: int, signals: list[Signal]) -> _Metrics:
    n = len(signals)
    if n == 0:
        return _Metrics(0, 0, 0, 0, 0, 0, None, 0, 0, 0)

    market = sum(1 for s in signals if (s.close_reason or "") == "market")
    target = sum(1 for s in signals if (s.close_reason or "") == "target")
    stop = sum(1 for s in signals if (s.close_reason or "") == "stop")

    holds = [m for s in signals if (m := _hold_minutes(s)) is not None]
    median_hold = float(median(holds)) if holds else 0.0

    week_ago = _now() - timedelta(days=7)
    week_count = sum(
        1
        for s in signals
        if s.closed_at and (s.closed_at if s.closed_at.tzinfo else s.closed_at.replace(tzinfo=timezone.utc)) >= week_ago
    )
    trades_per_week = float(week_count)

    captures: list[float] = []
    for s in signals:
        if s.status != "win":
            continue
        planned = _planned_rr(s)
        realized = _realized_r(s)
        if planned and planned > 0 and realized is not None:
            captures.append(min(realized / planned, 1.5))

    limit_entries = sum(1 for s in signals if entry_zone_defined(s.entry_low, s.entry_high))
    lev_high = sum(1 for s in signals if signal_leverage(s) > 1)

    trader = db.get(Trader, author_id)
    rank_cap = rank_max_stake_pct(trader.current_rank_id if trader else None) if trader else 100.0
    stake_ok = 0
    for s in signals:
        stake = s.risk_percent if s.risk_percent is not None and s.risk_percent > 0 else 10.0
        if stake <= rank_cap + 0.01:
            stake_ok += 1
    stake_discipline = stake_ok / n if n else 0.0

    return _Metrics(
        sample_size=n,
        market_rate=market / n,
        target_rate=target / n,
        stop_rate=stop / n,
        median_hold_min=median_hold,
        trades_per_week=trades_per_week,
        plan_capture_median=float(median(captures)) if captures else None,
        limit_entry_rate=limit_entries / n,
        leverage_rate=lev_high / n,
        stake_discipline=stake_discipline,
    )


def _format_hold(minutes: float) -> str:
    if minutes < 60:
        return f"~{int(round(minutes))} мин"
    if minutes < 24 * 60:
        h = minutes / 60.0
        return f"~{h:.1f} ч"
    d = minutes / (24 * 60)
    return f"~{d:.1f} д"


def _pick_archetype(m: _Metrics) -> str:
    if m.sample_size < MIN_SAMPLES:
        return "forming"

    scores: dict[str, float] = {k: 0.0 for k in _ARCHETYPE_COPY if k != "forming"}

    if m.target_rate >= 0.45 and m.market_rate < 0.25:
        scores["structurer"] += 3.0
    if m.target_rate >= 0.5 and m.median_hold_min >= 12 * 60 and (m.plan_capture_median or 0) >= 0.7:
        scores["diamond"] += 4.0
    if m.plan_capture_median is not None and m.plan_capture_median < 0.55 and m.market_rate < 0.4:
        scores["fixer"] += 3.0
    if m.plan_capture_median is not None and m.plan_capture_median < 0.45 and m.median_hold_min < 6 * 60:
        scores["paper"] += 3.0
    if m.median_hold_min < 2 * 60:
        scores["scalp"] += 2.5
    if m.trades_per_week <= 4 and m.market_rate < 0.3:
        scores["sniper"] += 2.5
    if m.trades_per_week >= 7:
        scores["grinder"] += 2.5
    if m.trades_per_week >= 10 and m.market_rate >= 0.3:
        scores["hyperactive"] += 4.0
    if m.median_hold_min >= 48 * 60:
        scores["patient"] += 3.0
    if m.market_rate >= 0.4:
        scores["reactive"] += 4.0
    if m.market_rate >= 0.35 and m.trades_per_week >= 6:
        scores["fomo"] += 3.0
    if m.stake_discipline >= 0.85 and m.market_rate < 0.2:
        scores["by_the_book"] += 2.5

    best = max(scores.items(), key=lambda x: x[1])
    if best[1] < 1.5:
        return "vibe"
    return best[0]


def _modifiers(m: _Metrics, archetype: str) -> list[str]:
    if archetype == "forming":
        return []
    tags: list[str] = []
    if m.target_rate >= 0.5:
        tags.append("до цели")
    if m.plan_capture_median is not None and m.plan_capture_median < 0.6:
        tags.append("раньше цели")
    if m.limit_entry_rate >= 0.5:
        tags.append("с лимитки")
    elif m.limit_entry_rate < 0.35:
        tags.append("с поста")
    if m.leverage_rate >= 0.4:
        tags.append("с плечом")
    elif m.leverage_rate <= 0.15:
        tags.append("1х спокойно")
    if m.median_hold_min >= 24 * 60 and m.trades_per_week <= 5:
        tags.append("чилл")
    # убрать дубли с архетипом
    dedup: list[str] = []
    for t in tags:
        if t not in dedup:
            dedup.append(t)
    return dedup[:3]


def _stats_line(m: _Metrics) -> str:
    if m.sample_size == 0:
        return ""
    hold = _format_hold(m.median_hold_min)
    return (
        f"В сделке {hold} · "
        f"{m.target_rate * 100:.0f}% цель · "
        f"{m.stop_rate * 100:.0f}% стоп · "
        f"{m.market_rate * 100:.0f}% рынок · "
        f"{m.trades_per_week:.0f} сд./нед"
    )


def build_volnovoi_style(
    db: Session,
    author_id: int,
    *,
    cult_candidate: bool = False,
) -> VolnovoiStyleRead:
    signals = _closed_signals(db, author_id, cult_candidate=cult_candidate)
    metrics = _collect_metrics(db, author_id, signals)
    archetype = _pick_archetype(metrics)
    title, description = _ARCHETYPE_COPY[archetype]
    tags = _modifiers(metrics, archetype)
    headline = title if not tags else f"{title} · {' · '.join(tags)}"
    ready = archetype != "forming"

    if not ready:
        description = (
            f"{description} Сейчас {metrics.sample_size} из {MIN_SAMPLES} нужных закрытых сделок."
        )

    return VolnovoiStyleRead(
        ready=ready,
        sample_size=metrics.sample_size,
        archetype=archetype,
        title=title,
        tags=tags,
        headline=headline,
        description=description,
        stats_line=_stats_line(metrics) if metrics.sample_size else "",
    )
