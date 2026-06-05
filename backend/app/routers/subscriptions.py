from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.deps import _telegram_user_from_sub, db_session, get_current_user
from app.models import Subscriber
from app.schemas import PaymentSubmit, SubscriptionInfo, SubscriptionUpdate, TelegramUser
from app.signal_service import register_subscriber
from app.referral_links import build_referral_link, referral_share_text, telegram_bot_username
from app.subscription_billing import (
    MONTH_USD,
    REFERRAL_BONUS_DAYS,
    TRIAL_DAYS,
    WEEK_USD,
    ensure_payment_memo,
    record_payment,
    usdt_pay_address,
)
from app.subscription_pause import SUBSCRIPTION_PAUSE_HINT

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


def _info(db, user: TelegramUser) -> SubscriptionInfo:
    sub = db.get(Subscriber, user.telegram_user_id)
    memo = ensure_payment_memo(db, sub) if sub is not None else ""
    code = (sub.referral_code if sub else None) or user.referral_code or ""
    bot = telegram_bot_username()
    link = build_referral_link(code)
    if link:
        hint = "Отправьте ссылку другу — после его оплаты подписки вам начислят +3 дня."
    elif code:
        hint = (
            "Задайте TELEGRAM_BOT_USERNAME в env (или BOT_TOKEN для автоопределения), "
            "чтобы сгенерировать ссылку приглашения."
        )
    else:
        hint = ""
    return SubscriptionInfo(
        usdt_ton_address=usdt_pay_address(),
        payment_memo=memo,
        week_usd=WEEK_USD,
        month_usd=MONTH_USD,
        trial_days=TRIAL_DAYS,
        referral_bonus_days=REFERRAL_BONUS_DAYS,
        subscription_until=sub.subscription_until if sub else None,
        subscription_active=user.subscription_active,
        trial_used=bool(sub.trial_used) if sub else False,
        referral_code=code,
        referral_link=link,
        referral_share_text=referral_share_text(bonus_days=REFERRAL_BONUS_DAYS) if link else "",
        bot_username=bot,
        referral_link_hint=hint,
        subscription_pause_hint=SUBSCRIPTION_PAUSE_HINT,
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
    if body.notify_enabled is not None:
        sub.notify_enabled = body.notify_enabled
    if body.notify_news_enabled is not None:
        sub.notify_news_enabled = body.notify_news_enabled
    db.commit()
    db.refresh(sub)
    return _telegram_user_from_sub(
        db,
        sub,
        telegram_user_id=user.telegram_user_id,
        is_admin=user.is_admin,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
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
    u2 = _telegram_user_from_sub(
        db,
        sub,
        telegram_user_id=user.telegram_user_id,
        is_admin=user.is_admin,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
    )
    return _info(db, u2)
