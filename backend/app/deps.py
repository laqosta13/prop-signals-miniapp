from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.leaderboard_service import fired_trader_ids
from app.schemas import TelegramUser
from app.trader_roster_service import can_publish_candidate_signals, is_main_feed_publisher
from app.signal_service import get_or_create_trader, register_subscriber
from app.review_access import review_write_access
from app.subscription_billing import (
    has_active_paid_subscription,
    subscription_active,
    subscription_active_strict,
)
from app.test_mode import test_mode_public_fields
from app.telegram_auth import validate_init_data


def get_current_user(
    db: Session = Depends(get_db),
    x_telegram_init_data: str | None = Header(default=None, alias="X-Telegram-Init-Data"),
    x_dev_telegram_user_id: str | None = Header(default=None, alias="X-Dev-Telegram-User-Id"),
) -> TelegramUser:
    if x_telegram_init_data and settings.bot_token:
        user = validate_init_data(x_telegram_init_data, settings.bot_token)
        if user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Telegram init data")
        sub = register_subscriber(db, user.id, user.username, user.start_param)
        is_admin = settings.is_signal_admin_id(user.id) and user.id not in fired_trader_ids(db)
        is_super_admin = settings.is_super_admin_id(user.id)
        can_main_feed = is_main_feed_publisher(db, user.id)
        if is_admin or can_main_feed:
            get_or_create_trader(
                db,
                user.id,
                user.username,
                first_name=user.first_name,
                last_name=user.last_name,
                photo_url=user.photo_url,
            )
        if db.new or db.dirty or db.deleted:
            db.commit()
        return _telegram_user_from_sub(
            db,
            sub,
            telegram_user_id=user.id,
            is_admin=is_admin,
            is_super_admin=is_super_admin,
            username=user.username,
            first_name=user.first_name,
            last_name=user.last_name,
        )

    if not settings.bot_token and x_dev_telegram_user_id:
        try:
            tid = int(x_dev_telegram_user_id.strip())
        except ValueError as e:
            raise HTTPException(status_code=400, detail="Bad dev user id") from e
        sub = register_subscriber(db, tid, None, None)
        is_admin = settings.is_signal_admin_id(tid) and tid not in fired_trader_ids(db)
        is_super_admin = settings.is_super_admin_id(tid)
        can_main_feed = is_main_feed_publisher(db, tid)
        if is_admin or can_main_feed:
            get_or_create_trader(db, tid, None)
        if db.new or db.dirty or db.deleted:
            db.commit()
        return _telegram_user_from_sub(
            db,
            sub,
            telegram_user_id=tid,
            is_admin=is_admin,
            is_super_admin=is_super_admin,
            username=None,
        )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing X-Telegram-Init-Data (or configure dev headers without BOT_TOKEN)",
    )


def require_active_subscription(user: TelegramUser = Depends(get_current_user)) -> TelegramUser:
    if user.is_admin or user.subscription_active:
        return user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="subscription_required",
    )


def require_admin(user: TelegramUser = Depends(get_current_user)) -> TelegramUser:
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return user


def require_main_feed_publisher(
    user: TelegramUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TelegramUser:
    if not is_main_feed_publisher(db, user.telegram_user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="main_feed_publisher_required")
    return user


def require_super_admin(user: TelegramUser = Depends(get_current_user)) -> TelegramUser:
    if not user.is_super_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super admin only")
    return user


def db_session(db: Session = Depends(get_db)) -> Session:
    return db


def _telegram_user_from_sub(
    db: Session,
    sub,
    *,
    telegram_user_id: int,
    is_admin: bool,
    is_super_admin: bool,
    username: str | None,
    first_name: str | None = None,
    last_name: str | None = None,
) -> TelegramUser:
    can_write, reason, days_left = review_write_access(db, sub, is_admin=is_admin)
    test_mode = test_mode_public_fields()
    return TelegramUser(
        telegram_user_id=telegram_user_id,
        is_admin=is_admin,
        is_super_admin=is_super_admin,
        can_publish_main_feed=is_main_feed_publisher(db, telegram_user_id),
        can_publish_candidate=can_publish_candidate_signals(db, telegram_user_id),
        username=username,
        first_name=first_name,
        last_name=last_name,
        notify_enabled=sub.notify_enabled,
        notify_news_enabled=bool(sub.notify_news_enabled),
        notify_push_active=bool(sub.notify_enabled)
        and subscription_active_strict(sub, is_admin=is_admin),
        subscription_until=sub.subscription_until,
        subscription_active=subscription_active(sub, is_admin),
        test_mode_active=test_mode["test_mode_active"],
        test_mode_until=test_mode["test_mode_until"],
        test_mode_days_left=int(test_mode["test_mode_days_left"]),
        referral_code=sub.referral_code or "",
        member_since=sub.created_at,
        paid_subscription=has_active_paid_subscription(db, sub, is_admin),
        can_write_review=can_write,
        review_write_blocked_reason=reason,
        days_until_review=days_left,
    )
