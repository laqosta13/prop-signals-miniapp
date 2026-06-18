"""Капсула времени: сообщение доставляется пользователю через Telegram в заданный момент."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import TimeCapsule

_DELAYS = {
    "1w": timedelta(weeks=1),
    "1m": timedelta(days=30),
    "3m": timedelta(days=90),
}

MAX_MESSAGE_LEN = 1000


def create_capsule(db: Session, telegram_user_id: int, message: str, delay_key: str) -> TimeCapsule:
    if delay_key not in _DELAYS:
        raise ValueError(f"Неверный период. Доступно: {', '.join(_DELAYS)}")
    message = message.strip()
    if not message:
        raise ValueError("Сообщение не может быть пустым")
    if len(message) > MAX_MESSAGE_LEN:
        raise ValueError(f"Максимум {MAX_MESSAGE_LEN} символов")

    now = datetime.now(timezone.utc)
    deliver_at = now + _DELAYS[delay_key]
    capsule = TimeCapsule(
        telegram_user_id=telegram_user_id,
        message=message,
        deliver_at=deliver_at,
    )
    db.add(capsule)
    db.flush()
    return capsule


def pending_capsules(db: Session) -> list[TimeCapsule]:
    now = datetime.now(timezone.utc)
    return list(
        db.scalars(
            select(TimeCapsule).where(
                TimeCapsule.deliver_at <= now,
                TimeCapsule.delivered_at.is_(None),
            )
        ).all()
    )


def mark_delivered(db: Session, capsule: TimeCapsule) -> None:
    capsule.delivered_at = datetime.now(timezone.utc)
