from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.deps import db_session, get_current_user
from app.models import Subscriber
from app.schemas import PaymentSubmit, SubscriptionInfo, SubscriptionUpdate, TelegramUser
from app.signal_service import register_subscriber
from app.subscription_billing import (
    MONTH_USD,
    REFERRAL_BONUS_DAYS,
    TRIAL_DAYS,
    WEEK_USD,
    record_payment,
    subscription_active,
    usdt_pay_address,
)

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


def _info(db, user: TelegramUser) -> SubscriptionInfo:
    sub = db.get(Subscriber, user.telegram_user_id)
    code = (sub.referral_code if sub else None) or user.referral_code or ""
    hint = f"Откройте приложение по ссылке бота с параметром startapp={code}" if code else ""
    return SubscriptionInfo(
        usdt_ton_address=usdt_pay_address(),
        week_usd=WEEK_USD,
        month_usd=MONTH_USD,
        trial_days=TRIAL_DAYS,
        referral_bonus_days=REFERRAL_BONUS_DAYS,
        subscription_until=sub.subscription_until if sub else None,
        subscription_active=user.subscription_active,
        referral_code=code,
        referral_link_hint=hint,
    )


@router.get("/info", response_model=SubscriptionInfo)
def subscription_info(
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(get_current_user),
) -> SubscriptionInfo:
    return _info(db, user)


@router.put("/me", response_model=TelegramUser)
def update_subscription(
    body: SubscriptionUpdate,
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(get_current_user),
) -> TelegramUser:
    sub = register_subscriber(db, user.telegram_user_id, user.username, None)
    sub.notify_enabled = body.notify_enabled
    db.commit()
    is_admin = user.is_admin
    return TelegramUser(
        telegram_user_id=user.telegram_user_id,
        is_admin=is_admin,
        username=user.username,
        notify_enabled=sub.notify_enabled,
        subscription_until=sub.subscription_until,
        subscription_active=subscription_active(sub, is_admin),
        referral_code=sub.referral_code or "",
    )


@router.post("/pay", response_model=SubscriptionInfo)
def submit_payment(
    body: PaymentSubmit,
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(get_current_user),
) -> SubscriptionInfo:
    try:
        record_payment(db, user.telegram_user_id, body.plan, body.tx_id)
        db.commit()
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    sub = db.get(Subscriber, user.telegram_user_id)
    if sub is None:
        raise HTTPException(status_code=500, detail="subscriber missing")
    u2 = TelegramUser(
        telegram_user_id=user.telegram_user_id,
        is_admin=user.is_admin,
        username=user.username,
        notify_enabled=sub.notify_enabled,
        subscription_until=sub.subscription_until,
        subscription_active=subscription_active(sub, user.is_admin),
        referral_code=sub.referral_code or "",
    )
    return _info(db, u2)
