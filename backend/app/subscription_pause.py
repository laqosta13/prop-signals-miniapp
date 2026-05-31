"""Пауза подписки: день без сигналов (MSK) не списывается."""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Signal, Subscriber, SubscriptionPauseDay
from app.tracker_metrics import msk_day_key

logger = logging.getLogger(__name__)

MSK = ZoneInfo("Europe/Moscow")
SUBSCRIPTION_PAUSE_HINT = (
    "Если за сутки (МСК) не было ни одного сигнала — день подписки не списывается, срок автоматически продлевается."
)


def _today_msk() -> date:
    return datetime.now(MSK).date()


def _yesterday_msk_key() -> str:
    return (_today_msk() - timedelta(days=1)).isoformat()


def _day_after(day_key: str) -> str:
    d = date.fromisoformat(day_key)
    return (d + timedelta(days=1)).isoformat()


def msk_day_start(day_key: str) -> datetime:
    y, m, d = (int(x) for x in day_key.split("-"))
    return datetime(y, m, d, 0, 0, 0, tzinfo=MSK)


def count_signals_on_msk_day(db: Session, day_key: str) -> int:
    rows = db.scalars(select(Signal)).all()
    return sum(1 for s in rows if msk_day_key(s.created_at) == day_key)


def pending_pause_day_keys(db: Session) -> list[str]:
    """Завершённые MSK-дни, которые ещё не обработаны (до вчера включительно)."""
    yesterday = _yesterday_msk_key()
    last = db.scalar(select(func.max(SubscriptionPauseDay.msk_date)))
    start = yesterday if last is None else _day_after(last)
    if start > yesterday:
        return []
    keys: list[str] = []
    cur = start
    while cur <= yesterday:
        keys.append(cur)
        cur = _day_after(cur)
    return keys


def extend_subscribers_for_pause_day(db: Session, day_key: str) -> int:
    """+1 день к subscription_until у всех, у кого подписка была активна в этот день."""
    start = msk_day_start(day_key)
    extended = 0
    for sub in db.scalars(select(Subscriber).where(Subscriber.subscription_until.isnot(None))).all():
        until = sub.subscription_until
        if until is None:
            continue
        if until.tzinfo is None:
            until = until.replace(tzinfo=timezone.utc)
        if until > start:
            sub.subscription_until = until + timedelta(days=1)
            extended += 1
    return extended


def process_subscription_pause_day(db: Session, day_key: str) -> int:
    if db.get(SubscriptionPauseDay, day_key) is not None:
        return 0
    signals_count = count_signals_on_msk_day(db, day_key)
    extended = 0
    if signals_count == 0:
        extended = extend_subscribers_for_pause_day(db, day_key)
        if extended:
            logger.info(
                "Subscription pause %s: no signals, extended %s subscriber(s)",
                day_key,
                extended,
            )
    db.add(
        SubscriptionPauseDay(
            msk_date=day_key,
            signals_count=signals_count,
            subscribers_extended=extended,
        )
    )
    return extended


def run_subscription_pause_once(db: Session) -> int:
    total = 0
    for day_key in pending_pause_day_keys(db):
        total += process_subscription_pause_day(db, day_key)
    return total
