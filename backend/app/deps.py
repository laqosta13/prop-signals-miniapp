from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.schemas import TelegramUser
from app.signal_service import get_or_create_trader, register_subscriber
from app.subscription_billing import subscription_active
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
        is_admin = user.id in settings.admin_id_set
        if is_admin:
            get_or_create_trader(
                db,
                user.id,
                user.username,
                first_name=user.first_name,
                last_name=user.last_name,
                photo_url=user.photo_url,
            )
        db.commit()
        return TelegramUser(
            telegram_user_id=user.id,
            is_admin=is_admin,
            username=user.username,
            first_name=user.first_name,
            last_name=user.last_name,
            notify_enabled=sub.notify_enabled,
            subscription_until=sub.subscription_until,
            subscription_active=subscription_active(sub, is_admin),
            referral_code=sub.referral_code or "",
        )

    if not settings.bot_token and x_dev_telegram_user_id:
        try:
            tid = int(x_dev_telegram_user_id.strip())
        except ValueError as e:
            raise HTTPException(status_code=400, detail="Bad dev user id") from e
        sub = register_subscriber(db, tid, None, None)
        db.commit()
        is_admin = tid in settings.admin_id_set
        return TelegramUser(
            telegram_user_id=tid,
            is_admin=is_admin,
            username=None,
            notify_enabled=sub.notify_enabled,
            subscription_until=sub.subscription_until,
            subscription_active=subscription_active(sub, is_admin),
            referral_code=sub.referral_code or "",
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


def db_session(db: Session = Depends(get_db)) -> Session:
    return db
