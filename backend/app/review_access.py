"""Правила доступа к отзывам."""

from __future__ import annotations

import math
from datetime import timedelta

from sqlalchemy.orm import Session

from app.models import Subscriber
from app.subscription_billing import REVIEW_WAIT_DAYS, _now, has_paid_subscription, subscription_active

REVIEW_BLOCK_PAID = "paid_required"
REVIEW_BLOCK_WAIT = "wait_days"
REVIEW_BLOCK_SUB = "subscription_required"


def review_write_access(
    db: Session, sub: Subscriber, *, is_admin: bool
) -> tuple[bool, str | None, int | None]:
    """Можно писать отзыв: платная активная подписка + 3 дня с первого входа."""
    if is_admin:
        return True, None, None
    if not subscription_active(sub, is_admin):
        return False, REVIEW_BLOCK_SUB, None
    if not has_paid_subscription(db, sub.telegram_user_id):
        return False, REVIEW_BLOCK_PAID, None
    created = sub.created_at
    if created.tzinfo is None:
        from datetime import timezone

        created = created.replace(tzinfo=timezone.utc)
    eligible_at = created + timedelta(days=REVIEW_WAIT_DAYS)
    now = _now()
    if now < eligible_at:
        remaining = eligible_at - now
        days_left = max(1, math.ceil(remaining.total_seconds() / 86400))
        return False, REVIEW_BLOCK_WAIT, days_left
    return True, None, None


def require_review_write(db: Session, sub: Subscriber, *, is_admin: bool) -> None:
    from fastapi import HTTPException, status

    ok, reason, days_left = review_write_access(db, sub, is_admin=is_admin)
    if ok:
        return
    detail = {
        REVIEW_BLOCK_SUB: "subscription_required",
        REVIEW_BLOCK_PAID: "paid_subscription_required",
        REVIEW_BLOCK_WAIT: "review_wait_days",
    }.get(reason or "", "forbidden")
    if reason == REVIEW_BLOCK_WAIT and days_left is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": detail, "days_left": days_left},
        )
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)
