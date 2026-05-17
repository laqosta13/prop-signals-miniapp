from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import db_session, get_current_user, require_admin
from app.engagement import record_view, toggle_like
from app.media_storage import delete_media_files, delete_signal_media_dir, save_signal_image, save_signal_video
from app.models import Signal
from app.schemas import LikeResponse, SignalRead, TelegramUser, ViewResponse
from app.serializers import signal_to_read
from app.signal_service import (
    build_signal_row,
    notify_deleted_signal,
    notify_new_signal,
    notify_updated_signal,
    update_signal_fields,
)

router = APIRouter(prefix="/signals", tags=["signals"])


def _parse_direction(direction: str) -> str:
    d = direction.strip().lower()
    if d not in ("long", "short"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="direction must be long or short")
    return d


@router.get("", response_model=list[SignalRead])
def list_signals(
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(get_current_user),
) -> list[SignalRead]:
    stmt = select(Signal).order_by(Signal.created_at.desc()).limit(200)
    rows = list(db.scalars(stmt).all())
    return [signal_to_read(db, s, user.telegram_user_id) for s in rows]


@router.post("", response_model=SignalRead)
async def create_signal(
    symbol: str = Form(...),
    direction: str = Form(...),
    entry_low: str | None = Form(None),
    entry_high: str | None = Form(None),
    stop_loss: str | None = Form(None),
    take_profits: str | None = Form(None),
    comment: str | None = Form(None),
    leverage: int | None = Form(None),
    risk_percent: float | None = Form(None),
    tracker_balance: float | None = Form(None),
    screenshot: UploadFile | None = File(None),
    video: UploadFile | None = File(None),
    db: Session = Depends(db_session),
    admin: TelegramUser = Depends(require_admin),
) -> SignalRead:
    row = build_signal_row(
        db,
        symbol=symbol.strip().upper(),
        direction=_parse_direction(direction),
        entry_low=entry_low or None,
        entry_high=entry_high or None,
        stop_loss=stop_loss or None,
        take_profits=take_profits or None,
        comment=comment or None,
        author_telegram_id=admin.telegram_user_id,
        author_username=admin.username,
        leverage=leverage,
        risk_percent=risk_percent,
        tracker_balance=tracker_balance,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    if screenshot and screenshot.filename:
        row.media_image_path = await save_signal_image(row.id, screenshot)
    if video and video.filename:
        row.media_video_path = await save_signal_video(row.id, video)
    if row.media_image_path or row.media_video_path:
        db.commit()
        db.refresh(row)

    await notify_new_signal(db, row)
    return signal_to_read(db, row, admin.telegram_user_id)


@router.put("/{signal_id}", response_model=SignalRead)
async def update_signal(
    signal_id: int,
    symbol: str = Form(...),
    direction: str = Form(...),
    entry_low: str | None = Form(None),
    entry_high: str | None = Form(None),
    stop_loss: str | None = Form(None),
    take_profits: str | None = Form(None),
    comment: str | None = Form(None),
    leverage: int | None = Form(None),
    risk_percent: float | None = Form(None),
    tracker_balance: float | None = Form(None),
    screenshot: UploadFile | None = File(None),
    video: UploadFile | None = File(None),
    remove_screenshot: bool = Form(False),
    remove_video: bool = Form(False),
    db: Session = Depends(db_session),
    admin: TelegramUser = Depends(require_admin),
) -> SignalRead:
    row = db.get(Signal, signal_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signal not found")
    if row.status != "active":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Можно редактировать только активный сигнал")

    update_signal_fields(
        row,
        symbol=symbol.strip().upper(),
        direction=_parse_direction(direction),
        entry_low=entry_low or None,
        entry_high=entry_high or None,
        stop_loss=stop_loss or None,
        take_profits=take_profits or None,
        comment=comment or None,
        leverage=leverage,
        risk_percent=risk_percent,
        tracker_balance=tracker_balance,
    )

    if remove_screenshot and row.media_image_path:
        delete_media_files(row.media_image_path)
        row.media_image_path = None
    if remove_video and row.media_video_path:
        delete_media_files(row.media_video_path)
        row.media_video_path = None
    if screenshot and screenshot.filename:
        delete_media_files(row.media_image_path)
        row.media_image_path = await save_signal_image(row.id, screenshot)
    if video and video.filename:
        delete_media_files(row.media_video_path)
        row.media_video_path = await save_signal_video(row.id, video)

    db.commit()
    db.refresh(row)
    await notify_updated_signal(db, row)
    return signal_to_read(db, row, admin.telegram_user_id)


@router.delete("/{signal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_signal(
    signal_id: int,
    db: Session = Depends(db_session),
    admin: TelegramUser = Depends(require_admin),
) -> None:
    _ = admin
    row = db.get(Signal, signal_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signal not found")
    if row.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Можно удалить только активный сигнал",
        )
    await notify_deleted_signal(db, row)
    delete_media_files(row.media_image_path, row.media_video_path)
    delete_signal_media_dir(signal_id)
    db.delete(row)
    db.commit()


@router.post("/{signal_id}/view", response_model=ViewResponse)
def add_view(
    signal_id: int,
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(get_current_user),
) -> ViewResponse:
    count = record_view(db, signal_id, user.telegram_user_id)
    if count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signal not found")
    return ViewResponse(views_count=count)


@router.post("/{signal_id}/like", response_model=LikeResponse)
def like_signal(
    signal_id: int,
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(get_current_user),
) -> LikeResponse:
    result = toggle_like(db, signal_id, user.telegram_user_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signal not found")
    liked, count = result
    return LikeResponse(liked=liked, likes_count=count)
