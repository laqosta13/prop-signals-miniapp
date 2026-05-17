from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Signal, Subscriber, Trader
from app.signal_utils import compute_signal_points_percent
from app.telegram_avatar import ensure_trader_avatar
from app.telegram_notify import (
    format_closed_signal_message,
    format_deleted_signal_message,
    format_new_signal_message,
    format_updated_signal_message,
    notify_subscribers,
)
from app.challenge_service import apply_signal_to_tracker, ensure_tracker_for_new_signal
from app.trader_stats import apply_outcome_to_trader, signal_risk_percent


def _normalize_trader_stats(trader: Trader) -> None:
    if trader.wins is None:
        trader.wins = 0
    if trader.losses is None:
        trader.losses = 0
    if trader.rating_percent is None:
        trader.rating_percent = 0.0
    if trader.total_pnl_usd is None:
        trader.total_pnl_usd = 0.0


def get_or_create_trader(db: Session, telegram_id: int, username: str | None) -> Trader:
    trader = db.get(Trader, telegram_id)
    if trader is None:
        trader = Trader(
            telegram_id=telegram_id,
            username=username,
            wins=0,
            losses=0,
            rating_percent=0.0,
            total_pnl_usd=0.0,
        )
        db.add(trader)
    else:
        _normalize_trader_stats(trader)
        if username and trader.username != username:
            trader.username = username
    if not trader.avatar_path:
        path = ensure_trader_avatar(telegram_id)
        if path:
            trader.avatar_path = path
    return trader


def register_subscriber(db: Session, telegram_id: int, username: str | None) -> Subscriber:
    sub = db.get(Subscriber, telegram_id)
    if sub is not None:
        if username and sub.username != username:
            sub.username = username
        return sub
    sub = Subscriber(telegram_user_id=telegram_id, username=username, notify_enabled=True)
    try:
        with db.begin_nested():
            db.add(sub)
            db.flush()
    except IntegrityError:
        sub = db.get(Subscriber, telegram_id)
        if sub is None:
            raise
    if username and sub.username != username:
        sub.username = username
    return sub


def subscriber_ids_for_notify(db: Session) -> list[int]:
    stmt = select(Subscriber.telegram_user_id).where(Subscriber.notify_enabled.is_(True))
    return list(db.scalars(stmt).all())


async def notify_new_signal(db: Session, signal: Signal) -> None:
    ids = subscriber_ids_for_notify(db)
    if ids:
        await notify_subscribers(format_new_signal_message(signal), ids)


async def notify_updated_signal(db: Session, signal: Signal) -> None:
    ids = subscriber_ids_for_notify(db)
    if ids:
        await notify_subscribers(format_updated_signal_message(signal), ids)


async def notify_deleted_signal(db: Session, signal: Signal) -> None:
    ids = subscriber_ids_for_notify(db)
    if ids:
        await notify_subscribers(format_deleted_signal_message(signal), ids)


def close_signal(db: Session, signal: Signal, outcome: str) -> None:
    if signal.status != "active":
        return
    signal.status = outcome
    signal.closed_at = datetime.now(timezone.utc)
    trader = get_or_create_trader(db, signal.author_telegram_id, signal.author_username)
    _normalize_trader_stats(trader)
    apply_outcome_to_trader(trader, signal, outcome)
    apply_signal_to_tracker(db, signal)
    db.commit()
    db.refresh(signal)


async def close_signal_and_notify(db: Session, signal: Signal, outcome: str) -> None:
    close_signal(db, signal, outcome)
    ids = subscriber_ids_for_notify(db)
    if ids:
        await notify_subscribers(format_closed_signal_message(signal), ids)


def build_signal_row(
    db: Session,
    *,
    symbol: str,
    direction: str,
    entry_low: str | None,
    entry_high: str | None,
    stop_loss: str | None,
    take_profits: str | None,
    comment: str | None,
    author_telegram_id: int,
    author_username: str | None,
    leverage: int | None = None,
    risk_percent: float | None = None,
    tracker_balance: float | None = None,
) -> Signal:
    points = risk_percent if risk_percent is not None else compute_signal_points_percent(entry_low, entry_high, stop_loss)
    get_or_create_trader(db, author_telegram_id, author_username)
    return Signal(
        symbol=symbol,
        direction=direction,
        entry_low=entry_low,
        entry_high=entry_high,
        stop_loss=stop_loss,
        take_profits=take_profits,
        comment=comment,
        status="active",
        points_percent=points,
        leverage=leverage,
        risk_percent=risk_percent or points,
        tracker_balance=tracker_balance,
        views_count=0,
        likes_count=0,
        author_telegram_id=author_telegram_id,
        author_username=author_username,
    )


def update_signal_fields(
    signal: Signal,
    *,
    symbol: str,
    direction: str,
    entry_low: str | None,
    entry_high: str | None,
    stop_loss: str | None,
    take_profits: str | None,
    comment: str | None,
    leverage: int | None,
    risk_percent: float | None,
    tracker_balance: float | None,
) -> None:
    signal.symbol = symbol
    signal.direction = direction
    signal.entry_low = entry_low
    signal.entry_high = entry_high
    signal.stop_loss = stop_loss
    signal.take_profits = take_profits
    signal.comment = comment
    signal.leverage = leverage
    if risk_percent is not None:
        signal.risk_percent = risk_percent
        signal.points_percent = risk_percent
    if tracker_balance is not None:
        signal.tracker_balance = tracker_balance
