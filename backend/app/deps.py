from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.schemas import TelegramUser
from app.telegram_auth import validate_init_data


def get_current_user(
    x_telegram_init_data: str | None = Header(default=None, alias="X-Telegram-Init-Data"),
    x_dev_telegram_user_id: str | None = Header(default=None, alias="X-Dev-Telegram-User-Id"),
) -> TelegramUser:
    """
    В Mini App клиент передаёт X-Telegram-Init-Data (window.Telegram.WebApp.initData).
    Для локальной отладки без Telegram: X-Dev-Telegram-User-Id (только если BOT_TOKEN пустой).
    """
    if x_telegram_init_data and settings.bot_token:
        user = validate_init_data(x_telegram_init_data, settings.bot_token)
        if user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Telegram init data")
        is_admin = user.id in settings.admin_id_set
        return TelegramUser(telegram_user_id=user.id, is_admin=is_admin)

    if not settings.bot_token and x_dev_telegram_user_id:
        try:
            tid = int(x_dev_telegram_user_id.strip())
        except ValueError as e:
            raise HTTPException(status_code=400, detail="Bad dev user id") from e
        is_admin = tid in settings.admin_id_set
        return TelegramUser(telegram_user_id=tid, is_admin=is_admin)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing X-Telegram-Init-Data (or configure dev headers without BOT_TOKEN)",
    )


def require_admin(user: TelegramUser = Depends(get_current_user)) -> TelegramUser:
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return user


def db_session(db: Session = Depends(get_db)) -> Session:
    return db
