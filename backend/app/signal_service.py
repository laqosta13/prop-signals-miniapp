from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Signal, Subscriber, Trader
from app.signal_utils import compute_signal_points_percent, evaluate_signal
from app.telegram_notify import format_closed_signal_message, format_new_signal_message, notify_subscribers


def get_or_create_trader(db: Session, telegram_id: int, username: str | None) -> Trader:
    trader = db.get(Trader, telegram_id)
    if trader is None:
        trader = Trader(telegram_id=telegram_id, username=username)
        db.add(trader)
    elif username and trader.username != username:
        trader.username = username
    return trader


def register_subscriber(db: Session, telegram_id: int, username: str | None) -> Subscriber:
    sub = db.get(Subscriber, telegram_id)
    if sub is None:
        sub = Subscriber(telegram_user_id=telegram_id, username=username, notify_enabled=True)
        db.add(sub)
    elif username and sub.username != username:
        sub.username = username
    return sub


def subscriber_ids_for_notify(db: Session) -> list[int]:
    stmt = select(Subscriber.telegram_user_id).where(Subscriber.notify_enabled.is_(True))
    return list(db.scalars(stmt).all())


async def notify_new_signal(db: Session, signal: Signal) -> None:
    ids = subscriber_ids_for_notify(db)
    if ids:
        await notify_subscribers(format_new_signal_message(signal), ids)


def close_signal(db: Session, signal: Signal, outcome: str) -> None:
    if signal.status != "active":
        return
    signal.status = outcome
    signal.closed_at = datetime.now(timezone.utc)
    trader = get_or_create_trader(db, signal.author_telegram_id, signal.author_username)
    pts = signal.points_percent
    if outcome == "win":
        trader.wins += 1
        trader.rating_percent = round(trader.rating_percent + pts, 2)
    else:
        trader.losses += 1
        trader.rating_percent = round(trader.rating_percent - pts, 2)
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
) -> Signal:
    points = compute_signal_points_percent(entry_low, entry_high, stop_loss)
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
        author_telegram_id=author_telegram_id,
        author_username=author_username,
    )
