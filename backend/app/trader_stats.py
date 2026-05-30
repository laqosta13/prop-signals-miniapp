"""P/L и рейтинг.

ТОП / rating_percent / weekly rank — чистый % движения цены (без плеча).
Трекер / realized_pnl — номинал (счёт × сумма входа % × плечо) × движение цены.
База номинала — account_size (размер счёта Hash Hedge), не накопленный баланс.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Signal, Trader
from app.signal_utils import (
    effective_entry_price,
    exit_price_for_outcome,
    outcome_from_move,
    price_move_pct,
    trade_move_pct,
)


DEFAULT_ENTRY_STAKE_PCT = 10.0


def signal_leverage(signal: Signal) -> int:
    lev = signal.leverage
    if lev is None or lev < 1:
        return 1
    return min(int(lev), 5)


def signal_entry_stake_pct(signal: Signal) -> float:
    """Маржа входа от трекера, % (только risk_percent; points_percent — расстояние до стопа)."""
    if signal.risk_percent is not None and signal.risk_percent > 0:
        return float(signal.risk_percent)
    return DEFAULT_ENTRY_STAKE_PCT


def signal_tracker_balance(signal: Signal) -> float:
    """Баланс трекера на момент публикации (для отображения)."""
    if signal.tracker_balance is not None and signal.tracker_balance > 0:
        return float(signal.tracker_balance)
    return 10_000.0


def signal_pnl_base_usd(signal: Signal) -> float:
    """База для номинала и P/L: размер счёта (account_size), не накопленный баланс."""
    if signal.account_size is not None and signal.account_size > 0:
        return float(signal.account_size)
    return signal_tracker_balance(signal)


def signal_entry_stake_usd(signal: Signal) -> float:
    """Номинал позиции в $ (с плечом): счёт × сумма входа % × плечо / 100."""
    return round(
        signal_pnl_base_usd(signal) * signal_entry_stake_pct(signal) / 100.0 * signal_leverage(signal),
        2,
    )


def signal_entry_price(signal: Signal) -> float | None:
    return effective_entry_price(
        signal.entry_low,
        signal.entry_high,
        signal.published_market_price,
    )


def signal_resolved_exit_price(signal: Signal) -> float | None:
    if signal.closed_exit_price is not None:
        return float(signal.closed_exit_price)
    if signal.status not in ("win", "lose"):
        return None
    return exit_price_for_outcome(
        signal.status,
        stop_loss=signal.stop_loss,
        take_profits=signal.take_profits,
        direction=signal.direction,
    )


def signal_price_move_pct(signal: Signal, outcome: str, exit_price: float | None = None) -> float:
    """Чистый % движения цены вход→выход. Плечо не учитывается — для ТОП и рангов."""
    if exit_price is None and signal.closed_exit_price is not None:
        exit_price = float(signal.closed_exit_price)
    return trade_move_pct(
        signal.entry_low,
        signal.entry_high,
        signal.direction,
        outcome,
        exit_price=exit_price,
        stop_loss=signal.stop_loss,
        take_profits=signal.take_profits,
        published_market_price=signal.published_market_price,
    )


def closed_signal_move_pct(signal: Signal) -> float:
    """% движения для закрытого сигнала — всегда по фактическому exit, если сохранён."""
    entry = signal_entry_price(signal)
    exit_px = signal_resolved_exit_price(signal)
    if entry is None or exit_px is None:
        return 0.0
    return price_move_pct(entry, signal.direction, exit_px)


def closed_signal_pnl_usd(signal: Signal) -> float:
    move = closed_signal_move_pct(signal)
    return round(signal_entry_stake_usd(signal) * move / 100.0, 2)


def outcome_from_pnl(pnl: float) -> str:
    """win/lose по фактическому P/L ($), 0 = win."""
    return "win" if pnl >= 0 else "lose"


def signal_realized_pnl_for_read(signal: Signal) -> float | None:
    """P/L для API: пересчёт по фактическому exit и сумме входа (risk_percent)."""
    if signal.status not in ("win", "lose"):
        return signal.realized_pnl
    return closed_signal_pnl_usd(signal)


def apply_outcome_to_trader(
    trader: Trader,
    signal: Signal,
    outcome: str,
    exit_price: float | None = None,
) -> None:
    move = signal_price_move_pct(signal, outcome, exit_price)
    outcome = outcome_from_move(move)
    pnl = round(signal_entry_stake_usd(signal) * move / 100.0, 2)
    signal.realized_pnl = pnl
    signal.status = outcome

    if trader.total_pnl_usd is None:
        trader.total_pnl_usd = 0.0
    if trader.rating_percent is None:
        trader.rating_percent = 0.0
    if trader.wins is None:
        trader.wins = 0
    if trader.losses is None:
        trader.losses = 0

    if pnl >= 0:
        trader.wins += 1
    else:
        trader.losses += 1

    trader.rating_percent = round(trader.rating_percent + move, 2)
    trader.total_pnl_usd = round(trader.total_pnl_usd + pnl, 2)

    from app.rank_service import add_weekly_pct

    add_weekly_pct(trader, move)


def _iso_week_key(dt: datetime | None) -> tuple[int, int] | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    iso = dt.astimezone(timezone.utc).isocalendar()
    return iso.year, iso.week


def rebuild_trader_stats_from_signals(db: Session, telegram_ids: list[int]) -> int:
    """Пересчёт рейтинга, win/lose, weekly_pct и realized_pnl из закрытых сигналов."""
    if not telegram_ids:
        return 0
    current_week = _iso_week_key(datetime.now(timezone.utc))
    updated = 0

    for tid in telegram_ids:
        trader = db.get(Trader, tid)
        if trader is None:
            continue

        trader.wins = 0
        trader.losses = 0
        trader.rating_percent = 0.0
        trader.total_pnl_usd = 0.0
        trader.weekly_pct = 0.0

        signals = list(
            db.scalars(
                select(Signal)
                .where(
                    Signal.author_telegram_id == tid,
                    Signal.status.in_(("win", "lose")),
                )
                .order_by(Signal.closed_at.asc(), Signal.id.asc())
            ).all()
        )

        for signal in signals:
            move = closed_signal_move_pct(signal)
            outcome = outcome_from_move(move)
            pnl = closed_signal_pnl_usd(signal)

            signal.status = outcome
            signal.realized_pnl = pnl

            if pnl >= 0:
                trader.wins += 1
            else:
                trader.losses += 1
            trader.rating_percent = round(trader.rating_percent + move, 2)
            trader.total_pnl_usd = round(trader.total_pnl_usd + pnl, 2)

            if _iso_week_key(signal.closed_at) == current_week:
                trader.weekly_pct = round((trader.weekly_pct or 0.0) + move, 2)

        updated += 1

    return updated
