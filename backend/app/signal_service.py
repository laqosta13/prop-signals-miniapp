from __future__ import annotations

from datetime import datetime, timezone

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Signal, Subscriber, Trader
from app.subscription_billing import subscription_active
from app.signal_utils import compute_signal_points_percent, entry_zone_defined, entry_triggered
from app.telegram_avatar import ensure_trader_avatar
from app.telegram_notify import (
    format_closed_signal_message,
    format_deleted_signal_message,
    format_entry_filled_message,
    format_new_signal_message,
    format_supplement_message,
    format_updated_signal_message,
    notify_subscribers,
)
from app.challenge_service import apply_signal_to_tracker, ensure_tracker_for_new_signal
from app.price_service import clear_price_cache, fetch_price
from app.subscription_billing import register_subscriber_with_meta
from app.trader_stats import apply_outcome_to_trader

logger = logging.getLogger(__name__)


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


def register_subscriber(db: Session, telegram_id: int, username: str | None, start_param: str | None = None) -> Subscriber:
    return register_subscriber_with_meta(db, telegram_id, username, start_param)


def subscriber_ids_for_notify(db: Session) -> list[int]:
    """Подписчики с активной подпиской и включёнными уведомлениями."""
    admin_ids = settings.admin_id_set
    subs = db.scalars(select(Subscriber).where(Subscriber.notify_enabled.is_(True))).all()
    ids: list[int] = []
    for sub in subs:
        if subscription_active(sub, sub.telegram_user_id in admin_ids):
            ids.append(sub.telegram_user_id)
    if not ids:
        logger.info("subscriber_ids_for_notify: 0 получателей (notify_enabled + активная подписка)")
    return ids


async def notify_new_signal(db: Session, signal: Signal) -> None:
    ids = subscriber_ids_for_notify(db)
    if ids:
        await notify_subscribers(format_new_signal_message(signal), ids)


async def notify_updated_signal(db: Session, signal: Signal, changes: list[str]) -> None:
    ids = subscriber_ids_for_notify(db)
    if ids:
        await notify_subscribers(format_updated_signal_message(signal, changes), ids)


async def notify_deleted_signal(db: Session, signal: Signal) -> None:
    ids = subscriber_ids_for_notify(db)
    if ids:
        await notify_subscribers(format_deleted_signal_message(signal), ids)


def close_signal(db: Session, signal: Signal, outcome: str, exit_price: float | None = None) -> None:
    if signal.status != "active":
        return
    signal.status = outcome
    signal.closed_at = datetime.now(timezone.utc)
    trader = get_or_create_trader(db, signal.author_telegram_id, signal.author_username)
    _normalize_trader_stats(trader)
    apply_outcome_to_trader(trader, signal, outcome, exit_price)
    apply_signal_to_tracker(db, signal)
    db.commit()
    db.refresh(signal)


async def close_signal_and_notify(db: Session, signal: Signal, outcome: str, exit_price: float | None = None) -> None:
    close_signal(db, signal, outcome, exit_price)
    ids = subscriber_ids_for_notify(db)
    if ids:
        await notify_subscribers(format_closed_signal_message(signal), ids)


async def notify_entry_filled(db: Session, signal: Signal) -> None:
    ids = subscriber_ids_for_notify(db)
    if ids:
        await notify_subscribers(format_entry_filled_message(signal), ids)


async def notify_signal_supplement(
    db: Session,
    signal: Signal,
    comment: str | None,
    *,
    has_image: bool = False,
    has_video: bool = False,
) -> None:
    ids = subscriber_ids_for_notify(db)
    if ids:
        await notify_subscribers(
            format_supplement_message(signal, comment, has_image=has_image, has_video=has_video),
            ids,
        )


async def try_fill_entry_from_market(db: Session, signal: Signal, *, notify: bool = True) -> bool:
    """Если цена уже прошла уровень входа — сразу отмечаем сигнал активным."""
    if signal.entry_filled_at is not None or signal.status != "active":
        return False
    if not entry_zone_defined(signal.entry_low, signal.entry_high):
        return False
    price = await fetch_price(signal.symbol)
    if price is None:
        logger.warning(
            "Нет цены для %s — вход не проверен (signal #%s)",
            signal.symbol,
            signal.id,
        )
        return False
    if not entry_triggered(price, signal.direction, signal.entry_low, signal.entry_high):
        return False
    signal.entry_filled_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(signal)
    logger.info(
        "Вход сработал: signal #%s %s %s, market=%.4f, entry=%s/%s",
        signal.id,
        signal.symbol,
        signal.direction,
        price,
        signal.entry_low,
        signal.entry_high,
    )
    if notify:
        await notify_entry_filled(db, signal)
    return True


async def sync_pending_entry_fills(
    db: Session,
    signals: list[Signal] | None = None,
    *,
    notify: bool = False,
) -> int:
    """Проверить активные сигналы без входа и отметить сработавшие по рынку."""
    if signals is None:
        stmt = select(Signal).where(Signal.status == "active", Signal.entry_filled_at.is_(None))
        pending = list(db.scalars(stmt).all())
    else:
        pending = [
            s
            for s in signals
            if s.status == "active"
            and s.entry_filled_at is None
            and entry_zone_defined(s.entry_low, s.entry_high)
        ]
    if not pending:
        return 0
    clear_price_cache()
    filled = 0
    for signal in pending:
        if await try_fill_entry_from_market(db, signal, notify=notify):
            filled += 1
    if filled:
        logger.info("Синхронизировано входов: %s", filled)
    return filled


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
        entry_filled_at=None if entry_zone_defined(entry_low, entry_high) else datetime.now(timezone.utc),
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
