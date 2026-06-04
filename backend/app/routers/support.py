from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.deps import db_session, get_current_user
from app.schemas import SupportInfo, SupportMessageCreate, SupportMessageRead, TelegramUser
from app.support_chat import (
    live_chat_enabled,
    list_messages,
    post_user_message,
)
from app.support_links import build_support_url, telegram_support_username

router = APIRouter(prefix="/support", tags=["support"])


def _message_to_read(row) -> SupportMessageRead:
    return SupportMessageRead(
        id=row.id,
        direction=row.direction,
        text=row.text,
        created_at=row.created_at,
    )


@router.get("/info", response_model=SupportInfo)
def support_info(_user: TelegramUser = Depends(get_current_user)) -> SupportInfo:
    username = telegram_support_username()
    url = build_support_url()
    chat_on = live_chat_enabled()
    return SupportInfo(
        live_chat_enabled=chat_on,
        username=username,
        url=url,
        available=chat_on or bool(url),
    )


@router.get("/messages", response_model=list[SupportMessageRead])
def support_messages(
    after_id: int = Query(0, ge=0),
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(get_current_user),
) -> list[SupportMessageRead]:
    rows = list_messages(db, user.telegram_user_id, after_id=after_id)
    return [_message_to_read(r) for r in rows]


@router.post("/messages", response_model=SupportMessageRead, status_code=status.HTTP_201_CREATED)
async def support_send_message(
    body: SupportMessageCreate,
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(get_current_user),
) -> SupportMessageRead:
    if not live_chat_enabled():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="support_chat_disabled")
    try:
        row = await post_user_message(
            db,
            telegram_user_id=user.telegram_user_id,
            username=user.username,
            first_name=user.first_name,
            text=body.text,
        )
        db.commit()
        db.refresh(row)
        return _message_to_read(row)
    except ValueError as e:
        code = str(e)
        status_code = status.HTTP_400_BAD_REQUEST
        if code in ("group_send_failed", "support_chat_disabled"):
            status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        raise HTTPException(status_code=status_code, detail=code) from e
