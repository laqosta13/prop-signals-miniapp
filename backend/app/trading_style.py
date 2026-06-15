"""Стиль volnovoi — сленговый профиль торговли по закрытым сигналам."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from statistics import mean, median

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
        "Стиль не раскрыт",
        "Мало закрытых сделок — профиль появится после пары недель в ленте.",
    ),
    "surgeon": (
        "Хирург",
        "Заходит по плану, выходит по цели, не нервничает. Минимум market-close, максимум точности.",
    ),
    "whalechaser": (
        "Китобой",
        "Охотится за крупными движениями — терпит, ждёт, берёт полную амплитуду.",
    ),
    "berserker": (
        "Берсерк",
        "Плечо, частые входы, закрывает по рынку — живёт в потоке. Либо всё, либо ничего.",
    ),
    "monk": (
        "Монах",
        "Редко, но точно. Ждёт сетап неделями и берёт чисто. Без суеты, без FOMO.",
    ),
    "piranha": (
        "Пиранья",
        "Вошёл — вышел — снова вошёл. Маленькие укусы, высокая частота, не жадничает до цели.",
    ),
    "marinator": (
        "Маринатор",
        "Маринует позицию сутками. Не дёргается, пока рынок делает своё дело.",
    ),
    "ghost": (
        "Призрак",
        "Ультракороткие заходы — зашёл, исчез. Никаких кемпов, никакого ожидания.",
    ),
    "strategist": (
        "Стратег",
        "Только лимитки, только структура. Входит по заявке и дожидается сценария.",
    ),
    "adrenaline": (
        "Адреналинщик",
        "Живёт на ощущении — часто закрывает по рынку, реагирует на движение в моменте.",
    ),
    "machine": (
        "Машина",
        "Стабильно гриндит: много сделок, дисциплина MM, без эмоций и лишних движений.",
    ),
    "gunslinger": (
        "Ковбой",
        "Быстро стреляет. Много входов, часто закрывает по рынку, нет времени думать.",
    ),
    "thermonuke": (
        "Термояд",
        "Максимальное плечо + крупные заходы + охотится на тренды. Либо взрыв, либо пепел.",
    ),
    "ironhands": (
        "Стальной",
        "Принимает убытки по стопу без паники и ручного закрытия. Железная дисциплина риска.",
    ),
    "contrarian": (
        "Контрарианец",
        "Шортит когда все покупают, лонгует когда все шортят. Против толпы — и часто прав.",
    ),
    "longbias": (
        "Лонгист",
        "Верит в рост. Почти всегда лонг — медведь не живёт в этом портфеле.",
    ),
    "shortbias": (
        "Шортист",
        "Видит медведя везде. Шортит стабильно, не переубедить.",
    ),
    "vibe": (
        "На вайбе",
        "Смешанный стиль без чёткого почерка — торгует по настроению рынка.",
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
    # новые метрики
    long_rate: float
    avg_realized_rr: float | None
    big_move_rate: float
    avg_leverage: float


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
        return _Metrics(0, 0, 0, 0, 0, 0, None, 0, 0, 0, 0.5, None, 0, 1.0)

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
    realized_rrs: list[float] = []
    for s in signals:
        if s.status != "win":
            continue
        planned = _planned_rr(s)
        realized = _realized_r(s)
        if planned and planned > 0 and realized is not None:
            captures.append(min(realized / planned, 1.5))
            realized_rrs.append(realized)

    limit_entries = sum(1 for s in signals if entry_zone_defined(s.entry_low, s.entry_high))
    lev_high = sum(1 for s in signals if signal_leverage(s) > 1)

    leverages = [signal_leverage(s) for s in signals]
    avg_lev = float(mean(leverages)) if leverages else 1.0

    trader = db.get(Trader, author_id)
    rank_cap = rank_max_stake_pct(trader.current_rank_id if trader else None) if trader else 100.0
    stake_ok = 0
    for s in signals:
        stake = s.risk_percent if s.risk_percent is not None and s.risk_percent > 0 else 10.0
        if stake <= rank_cap + 0.01:
            stake_ok += 1
    stake_discipline = stake_ok / n if n else 0.0

    # лонг-шорт перевес
    longs = sum(1 for s in signals if (s.direction or "").lower() == "long")
    long_rate = longs / n if n else 0.5

    # среднее R:R (в прибыльных сделках)
    avg_rr: float | None = round(mean(realized_rrs), 2) if realized_rrs else None

    # доля сделок с движением > 1.5% (крупные амплитуды)
    big_moves = sum(1 for s in signals if abs(closed_signal_move_pct(s)) >= 1.5)
    big_move_rate = big_moves / n if n else 0.0

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
        long_rate=long_rate,
        avg_realized_rr=avg_rr,
        big_move_rate=big_move_rate,
        avg_leverage=avg_lev,
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

    # Хирург: целевой, точный, без паники
    if m.target_rate >= 0.5 and m.market_rate < 0.2 and m.stake_discipline >= 0.8:
        scores["surgeon"] += 4.5
    if (m.avg_realized_rr or 0) >= 1.5 and m.market_rate < 0.25:
        scores["surgeon"] += 2.0

    # Китобой: крупные движения + долго держит + редко входит
    if m.big_move_rate >= 0.4 and m.median_hold_min >= 8 * 60:
        scores["whalechaser"] += 4.0
    if m.trades_per_week <= 3 and m.big_move_rate >= 0.3:
        scores["whalechaser"] += 2.5

    # Берсерк: плечо + частые + market close
    if m.leverage_rate >= 0.5 and m.market_rate >= 0.3 and m.trades_per_week >= 5:
        scores["berserker"] += 5.0
    if m.avg_leverage >= 2.5 and m.trades_per_week >= 4:
        scores["berserker"] += 2.0

    # Монах: редко, долго, чисто
    if m.trades_per_week <= 2 and m.median_hold_min >= 24 * 60 and m.market_rate < 0.25:
        scores["monk"] += 5.0
    if m.limit_entry_rate >= 0.6 and m.trades_per_week <= 3:
        scores["monk"] += 1.5

    # Пиранья: быстро + часто + малые движения
    if m.median_hold_min < 60 and m.trades_per_week >= 6 and m.big_move_rate < 0.25:
        scores["piranha"] += 5.0
    if m.median_hold_min < 30 and m.trades_per_week >= 5:
        scores["piranha"] += 2.0

    # Маринатор: очень долго держит
    if m.median_hold_min >= 48 * 60:
        scores["marinator"] += 4.0
    if m.median_hold_min >= 24 * 60 and m.market_rate < 0.2:
        scores["marinator"] += 2.0

    # Призрак: ультракороткие, бесшумный
    if m.median_hold_min < 15 and m.trades_per_week >= 4:
        scores["ghost"] += 5.0
    if m.median_hold_min < 30 and m.market_rate < 0.3:
        scores["ghost"] += 1.5

    # Стратег: лимитки + план + цели
    if m.limit_entry_rate >= 0.65 and m.target_rate >= 0.5 and m.market_rate < 0.2:
        scores["strategist"] += 5.0
    if m.limit_entry_rate >= 0.55 and (m.plan_capture_median or 0) >= 0.7:
        scores["strategist"] += 2.0

    # Адреналинщик: много market close, реактивный
    if m.market_rate >= 0.5:
        scores["adrenaline"] += 5.0
    if m.market_rate >= 0.35 and m.trades_per_week >= 5:
        scores["adrenaline"] += 2.0

    # Машина: стабильный гриндер с дисциплиной
    if m.trades_per_week >= 7 and m.stake_discipline >= 0.85 and m.market_rate < 0.35:
        scores["machine"] += 4.5
    if m.trades_per_week >= 5 and m.target_rate >= 0.4 and m.stake_discipline >= 0.8:
        scores["machine"] += 1.5

    # Ковбой: частый, импульсивный, много market close
    if m.trades_per_week >= 6 and m.market_rate >= 0.3 and m.median_hold_min < 4 * 60:
        scores["gunslinger"] += 4.5
    if m.market_rate >= 0.25 and m.trades_per_week >= 5:
        scores["gunslinger"] += 1.5

    # Термояд: высокое плечо + крупные движения
    if m.avg_leverage >= 3.0 and m.big_move_rate >= 0.35:
        scores["thermonuke"] += 5.0
    if m.leverage_rate >= 0.6 and m.big_move_rate >= 0.25:
        scores["thermonuke"] += 2.5

    # Стальной: берёт стоп без паники, не закрывает руками
    if m.stop_rate >= 0.25 and m.market_rate < 0.15 and m.stake_discipline >= 0.85:
        scores["ironhands"] += 4.5
    if m.market_rate < 0.1 and m.stake_discipline >= 0.9:
        scores["ironhands"] += 2.0

    # Контрарианец: шортит против толпы + хороший R:R
    if m.long_rate < 0.3 and (m.avg_realized_rr or 0) >= 1.2:
        scores["contrarian"] += 4.0
    if m.long_rate < 0.25 and m.target_rate >= 0.4:
        scores["contrarian"] += 2.0

    # Лонгист / Шортист: явный перевес направления
    if m.long_rate >= 0.75:
        scores["longbias"] += 3.5
    if m.long_rate >= 0.85:
        scores["longbias"] += 2.0

    if m.long_rate <= 0.25:
        scores["shortbias"] += 3.5
    if m.long_rate <= 0.15:
        scores["shortbias"] += 2.0

    best = max(scores.items(), key=lambda x: x[1])
    if best[1] < 1.5:
        return "vibe"
    return best[0]


def _modifiers(m: _Metrics, archetype: str) -> list[str]:
    if archetype == "forming":
        return []
    tags: list[str] = []

    # R:R монстр
    if (m.avg_realized_rr or 0) >= 2.0:
        tags.append("R:R монстр")
    elif (m.avg_realized_rr or 0) >= 1.4:
        tags.append("хороший R:R")

    # направление (если не лонгист/шортист-архетип)
    if archetype not in ("longbias", "shortbias", "contrarian"):
        if m.long_rate >= 0.7:
            tags.append("лонг-байас")
        elif m.long_rate <= 0.3:
            tags.append("шорт-байас")

    # вход
    if m.limit_entry_rate >= 0.65 and archetype not in ("strategist", "monk"):
        tags.append("с лимитки")
    elif m.limit_entry_rate < 0.25:
        tags.append("с поста")

    # плечо
    if m.avg_leverage >= 3.0 and archetype not in ("thermonuke", "berserker"):
        tags.append("с плечом")
    elif m.avg_leverage < 1.2 and m.leverage_rate < 0.15:
        tags.append("1х без плеча")

    # время
    if m.median_hold_min >= 24 * 60 and archetype not in ("marinator", "monk", "whalechaser"):
        tags.append("долго держит")
    elif m.median_hold_min < 20 and archetype not in ("ghost", "piranha"):
        tags.append("быстрые руки")

    # крупные движения
    if m.big_move_rate >= 0.5 and archetype not in ("whalechaser", "thermonuke"):
        tags.append("ловит тренд")

    # дисциплина
    if m.stake_discipline >= 0.95 and archetype not in ("ironhands", "surgeon", "machine", "strategist"):
        tags.append("жёсткий MM")

    dedup: list[str] = []
    for t in tags:
        if t not in dedup:
            dedup.append(t)
    return dedup[:3]


def _stats_line(m: _Metrics) -> str:
    if m.sample_size == 0:
        return ""
    hold = _format_hold(m.median_hold_min)
    rr_part = f" · R:R {m.avg_realized_rr:.1f}" if m.avg_realized_rr else ""
    direction_part = ""
    if m.long_rate >= 0.7:
        direction_part = f" · {int(m.long_rate * 100)}% лонг"
    elif m.long_rate <= 0.3:
        direction_part = f" · {int((1 - m.long_rate) * 100)}% шорт"
    return (
        f"В сделке {hold} · "
        f"{m.target_rate * 100:.0f}% цель · "
        f"{m.stop_rate * 100:.0f}% стоп · "
        f"{m.market_rate * 100:.0f}% рынок · "
        f"{m.trades_per_week:.0f} сд./нед"
        f"{rr_part}{direction_part}"
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
