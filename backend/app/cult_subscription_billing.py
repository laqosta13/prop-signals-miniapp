"""Подписка кандидата CULT — отдельно от ленты ($20 / 30 дней)."""

from __future__ import annotations

from datetime import timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import PaymentTx, Subscriber
from app.subscription_billing import _now, ensure_payment_memo
from app.ton_payments import TonPaymentError, verify_usdt_ton_payment

CULT_SUBSCRIPTION_USD = 20.0
CULT_SUBSCRIPTION_DAYS = 30
CULT_PLAN = "cult"


def cult_subscription_active(sub: Subscriber | None, *, is_admin: bool = False) -> bool:
    from app.test_mode import is_test_mode_active

    if is_admin:
        return True
    if is_test_mode_active():
        return True
    if sub is None or sub.cult_subscription_until is None:
        return False
    until = sub.cult_subscription_until
    if until.tzinfo is None:
        until = until.replace(tzinfo=timezone.utc)
    return until > _now()


def has_cult_paid_payment(db: Session, telegram_user_id: int) -> bool:
    return (
        db.scalar(
            select(PaymentTx.id).where(
                PaymentTx.telegram_user_id == telegram_user_id,
                PaymentTx.plan == CULT_PLAN,
            ).limit(1)
        )
        is not None
    )


def extend_cult_subscription(db: Session, sub: Subscriber, days: int) -> None:
    base = _now()
    if sub.cult_subscription_until and sub.cult_subscription_until > base:
        base = sub.cult_subscription_until
    sub.cult_subscription_until = base + timedelta(days=days)


def record_cult_payment(db: Session, telegram_user_id: int, tx_id: str) -> None:
    sub = db.get(Subscriber, telegram_user_id)
    if sub is None:
        raise ValueError("Подписчик не найден")
    memo = ensure_payment_memo(db, sub)
    try:
        check = verify_usdt_ton_payment(tx_id, CULT_SUBSCRIPTION_USD, expected_memo=memo)
    except TonPaymentError as e:
        raise ValueError(str(e)) from e
    if db.scalar(select(PaymentTx.id).where(PaymentTx.tx_id == check.tx_hash_hex)):
        raise ValueError("Этот TXID уже зарегистрирован")
    extend_cult_subscription(db, sub, CULT_SUBSCRIPTION_DAYS)
    db.add(
        PaymentTx(
            telegram_user_id=telegram_user_id,
            tx_id=check.tx_hash_hex,
            plan=CULT_PLAN,
            amount_usd=CULT_SUBSCRIPTION_USD,
        )
    )
    db.flush()
