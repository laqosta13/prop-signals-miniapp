import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.cult_channel_service import (
    build_cult_channels_read,
    channel_public_url,
    delete_cult_channel,
    normalize_channel_username,
    resolve_channel,
)
from app.deps import db_session, get_current_user, require_super_admin
from app.models import CultChannel
from app.schemas import CultChannelCreateBody, CultChannelRead, TelegramUser
from app.telegram_bot_api import TelegramApiError

router = APIRouter(prefix="/cult-channels", tags=["cult-channels"])


@router.get("", response_model=list[CultChannelRead])
def list_cult_channels(
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(get_current_user),
) -> list[CultChannelRead]:
    _ = user
    return build_cult_channels_read(db)


@router.post("", response_model=CultChannelRead, status_code=status.HTTP_201_CREATED)
async def create_cult_channel(
    body: CultChannelCreateBody,
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(require_super_admin),
) -> CultChannelRead:
    url = body.url.strip()
    try:
        username = normalize_channel_username(url)
        existing = db.scalar(select(CultChannel).where(CultChannel.username == username))
        if existing:
            raise ValueError("Канал уже подключён")

        chat_id, title, uname = await asyncio.to_thread(resolve_channel, username)
        row = CultChannel(
            title=title,
            username=uname,
            chat_id=chat_id,
            channel_url=channel_public_url(uname),
            connected_at=datetime.now(timezone.utc),
            added_by_telegram_id=user.telegram_user_id,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except (RuntimeError, TelegramApiError) as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e)) from e
    rows = build_cult_channels_read(db)
    found = next((r for r in rows if r.id == row.id), None)
    if found is None:
        raise HTTPException(status_code=500, detail="channel_created_but_unreadable")
    return found


@router.delete("/{channel_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_cult_channel(
    channel_id: int,
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(require_super_admin),
) -> None:
    _ = user
    try:
        delete_cult_channel(db, channel_id)
        db.commit()
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
