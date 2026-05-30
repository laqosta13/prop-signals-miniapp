from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.cult_channel_service import add_cult_channel, build_cult_channels_read, delete_cult_channel
from app.deps import db_session, get_current_user, require_admin
from app.schemas import CultChannelCreateBody, CultChannelRead, TelegramUser

router = APIRouter(prefix="/cult-channels", tags=["cult-channels"])


@router.get("", response_model=list[CultChannelRead])
def list_cult_channels(
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(get_current_user),
) -> list[CultChannelRead]:
    _ = user
    return build_cult_channels_read(db)


@router.post("", response_model=CultChannelRead, status_code=status.HTTP_201_CREATED)
def create_cult_channel(
    body: CultChannelCreateBody,
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(require_admin),
) -> CultChannelRead:
    try:
        row = add_cult_channel(db, body.url.strip(), user.telegram_user_id)
        db.commit()
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except RuntimeError as e:
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
    user: TelegramUser = Depends(require_admin),
) -> None:
    _ = user
    try:
        delete_cult_channel(db, channel_id)
        db.commit()
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
