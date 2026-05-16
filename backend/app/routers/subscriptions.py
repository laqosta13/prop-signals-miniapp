from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.deps import db_session, get_current_user
from app.schemas import SubscriptionUpdate, TelegramUser
from app.signal_service import register_subscriber

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


@router.put("/me", response_model=TelegramUser)
def update_subscription(
    body: SubscriptionUpdate,
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(get_current_user),
) -> TelegramUser:
    sub = register_subscriber(db, user.telegram_user_id, user.username)
    sub.notify_enabled = body.notify_enabled
    db.commit()
    return TelegramUser(
        telegram_user_id=user.telegram_user_id,
        is_admin=user.is_admin,
        username=user.username,
        notify_enabled=sub.notify_enabled,
    )
