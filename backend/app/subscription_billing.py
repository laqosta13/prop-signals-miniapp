"""Подписка, рефералы, оплата USDT TON (по TXID)."""

from __future__ import annotations

import secrets
import string
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import PaymentTx, Subscriber
from app.ton_payments import TonPaymentError, verify_usdt_ton_payment

TRIAL_DAYS = 3
REFERRAL_BONUS_DAYS = 3
REVIEW_WAIT_DAYS = 3
WEEK_USD = 20.0
MONTH_USD = 70.0
WEEK_DAYS = 7
MONTH_DAYS = 30


def _now() -> datetime:
    return datetime.now(timezone.utc)


def usdt_pay_address() -> str:
    return getattr(settings, "usdt_ton_address", None) or "UQDdFFYSG8sGiQfps2WWuIWFuaDPv1GAcFeRck6y5oeR_sPe"


def _subscription_until_active(sub: Subscriber | None) -> bool:
    if sub is None or sub.subscription_until is None:
        return False
    until = sub.subscription_until
    if until.tzinfo is None:
        until = until.replace(tzinfo=timezone.utc)
    return until > _now()


def subscription_active(sub: Subscriber | None, is_admin: bool) -> bool:
    if is_admin:
        return True
    if not settings.bot_token:
        return True
    return _subscription_until_active(sub)


def subscription_active_strict(sub: Subscriber | None, *, is_admin: bool = False) -> bool:
    """Для push-уведомлений — без dev-bypass, только реальная подписка или админ."""
    if is_admin:
        return True
    return _subscription_until_active(sub)


def has_paid_subscription(db: Session, telegram_user_id: int) -> bool:
    return (
        db.scalar(select(PaymentTx.id).where(PaymentTx.telegram_user_id == telegram_user_id).limit(1))
        is not None
    )


def has_active_paid_subscription(db: Session, sub: Subscriber, is_admin: bool) -> bool:
    if is_admin:
        return True
    if not _subscription_until_active(sub):
        return False
    return has_paid_subscription(db, sub.telegram_user_id)


def subscriber_ids_for_news_notify(db: Session) -> list[int]:
    """Все зарегистрированные пользователи — подписка и оплата не проверяются."""
    return list(db.scalars(select(Subscriber.telegram_user_id)).all())


def _gen_referral_code(db: Session) -> str:
    alphabet = string.ascii_uppercase + string.digits
    for _ in range(50):
        code = "".join(secrets.choice(alphabet) for _ in range(8))
        exists = db.scalar(select(Subscriber.telegram_user_id).where(Subscriber.referral_code == code))
        if not exists:
            return code
    return secrets.token_hex(4).upper()[:8]


def grant_referrer_bonus(db: Session, referrer_id: int) -> None:
    ref_sub = db.get(Subscriber, referrer_id)
    if ref_sub is None:
        return
    base = _now()
    if ref_sub.subscription_until and ref_sub.subscription_until > base:
        base = ref_sub.subscription_until
    ref_sub.subscription_until = base + timedelta(days=REFERRAL_BONUS_DAYS)


def grant_referrer_bonus_on_first_payment(db: Session, sub: Subscriber) -> None:
    """+3 дня рефереру, когда приглашённый впервые оплатил неделю или месяц."""
    referrer_id = sub.referred_by_telegram_id
    if not referrer_id or referrer_id == sub.telegram_user_id:
        return
    paid_rows = db.scalars(select(PaymentTx.id).where(PaymentTx.telegram_user_id == sub.telegram_user_id)).all()
    if len(paid_rows) != 1:
        return
    grant_referrer_bonus(db, referrer_id)


def register_subscriber_with_meta(
    db: Session, telegram_id: int, username: str | None, start_param: str | None
) -> Subscriber:
    from sqlalchemy.exc import IntegrityError

    sub = db.get(Subscriber, telegram_id)
    if sub is not None:
        if username and sub.username != username:
            sub.username = username
        return sub

    code = (start_param or "").strip().upper()[:16]
    referrer_id: int | None = None
    if code:
        referrer_id = db.scalar(select(Subscriber.telegram_user_id).where(Subscriber.referral_code == code))

    sub = Subscriber(
        telegram_user_id=telegram_id,
        username=username,
        notify_enabled=True,
        notify_news_enabled=False,
        subscription_until=_now() + timedelta(days=TRIAL_DAYS),
        referral_code=_gen_referral_code(db),
        referred_by_telegram_id=referrer_id if referrer_id and referrer_id != telegram_id else None,
    )
    created = False
    try:
        with db.begin_nested():
            db.add(sub)
            db.flush()
            created = True
    except IntegrityError:
        sub = db.get(Subscriber, telegram_id)
        if sub is None:
            raise
    if username and sub.username != username:
        sub.username = username
    return sub


def extend_subscription(db: Session, sub: Subscriber, days: int) -> None:
    base = _now()
    if sub.subscription_until and sub.subscription_until > base:
        base = sub.subscription_until
    sub.subscription_until = base + timedelta(days=days)


def record_payment(db: Session, telegram_user_id: int, plan: str, tx_id: str) -> None:
    if plan not in ("week", "month"):
        raise ValueError("plan: week или month")
    expected_usd = WEEK_USD if plan == "week" else MONTH_USD
    try:
        check = verify_usdt_ton_payment(tx_id, expected_usd)
    except TonPaymentError as e:
        raise ValueError(str(e)) from e
    if db.scalar(select(PaymentTx.id).where(PaymentTx.tx_id == check.tx_hash_hex)):
        raise ValueError("Этот TXID уже зарегистрирован")
    days = WEEK_DAYS if plan == "week" else MONTH_DAYS
    sub = db.get(Subscriber, telegram_user_id)
    if sub is None:
        raise ValueError("Подписчик не найден")
    extend_subscription(db, sub, days)
    db.add(
        PaymentTx(
            telegram_user_id=telegram_user_id,
            tx_id=check.tx_hash_hex,
            plan=plan,
            amount_usd=expected_usd,
        )
    )
    db.flush()
    grant_referrer_bonus_on_first_payment(db, sub)
