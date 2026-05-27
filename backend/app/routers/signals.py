from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.deps import db_session, get_current_user, require_active_subscription, require_admin
from app.signal_permissions import require_signal_engagement, require_signal_owner
from app.engagement import record_view, toggle_like
from app.media_storage import (
    delete_media_files,
    delete_signal_media_dir,
    save_signal_image,
    save_signal_video,
    save_supplement_image,
    save_supplement_video,
)
from app.models import Signal, SignalSupplement
from app.schemas import LikeResponse, MarketPriceRead, SignalRead, TelegramUser, ViewResponse
from app.feed_serializers import FEED_SIGNAL_LIMIT, signals_list_read
from app.serializers import signal_to_read
from app.price_service import fetch_bybit_perp_quote, normalize_symbol
from app.challenge_service import admin_tracker_balance, ensure_tracker_for_new_signal
from app.signal_service import (
    build_signal_row,
    close_signal_at_market,
    notify_deleted_signal,
    notify_new_signal,
    notify_signal_supplement,
    notify_updated_signal,
    stamp_signal_at_publication,
    try_fill_entry_from_market,
    update_signal_fields,
)
from app.telegram_notify import snapshot_signal, diff_signal_changes
from app.signal_utils import entry_zone_defined, signal_awaiting_entry, signal_in_trade

router = APIRouter(prefix="/signals", tags=["signals"])


def _parse_direction(direction: str) -> str:
    d = direction.strip().lower()
    if d not in ("long", "short"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="direction must be long or short")
    return d


@router.get("", response_model=list[SignalRead])
async def list_signals(
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(require_active_subscription),
) -> list[SignalRead]:
    """Полная лента — только с активной подпиской (или админ)."""
    stmt = select(Signal).order_by(Signal.created_at.desc()).limit(FEED_SIGNAL_LIMIT)
    rows = list(db.scalars(stmt).all())
    return signals_list_read(db, rows, user.telegram_user_id)


@router.get("/preview", response_model=list[SignalRead])
async def list_signals_preview(
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(get_current_user),
) -> list[SignalRead]:
    """Бесплатная лента — только отработанные сигналы (win/lose), без активных."""
    stmt = (
        select(Signal)
        .where(Signal.status.in_(("win", "lose")))
        .order_by(Signal.created_at.desc())
        .limit(FEED_SIGNAL_LIMIT)
    )
    rows = list(db.scalars(stmt).all())
    return signals_list_read(db, rows, user.telegram_user_id)


@router.get("/market-price", response_model=MarketPriceRead)
async def market_price(
    symbol: str,
    _admin: TelegramUser = Depends(require_admin),
) -> MarketPriceRead:
    """Текущий курс Bybit USDT perpetual для формы нового сигнала (админ)."""
    sym = normalize_symbol(symbol)
    if not sym:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="symbol required")
    quote = await fetch_bybit_perp_quote(sym)
    if quote is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Не удалось получить цену Bybit (бессрочный) для {sym}",
        )
    return MarketPriceRead(symbol=sym, price=quote.price, source=quote.source)


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
    tb = admin_tracker_balance(db, admin.telegram_user_id)
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
        author_first_name=admin.first_name,
        author_last_name=admin.last_name,
        leverage=leverage,
        risk_percent=risk_percent,
        tracker_balance=tb,
    )
    db.add(row)
    db.flush()
    ensure_tracker_for_new_signal(db, row)

    if screenshot and screenshot.filename:
        row.media_image_path = await save_signal_image(row.id, screenshot)
    if video and video.filename:
        row.media_video_path = await save_signal_video(row.id, video)

    await stamp_signal_at_publication(db, row)
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
    require_signal_owner(row, admin)
    if not signal_awaiting_entry(row):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Редактировать можно только до срабатывания входа",
        )

    before = snapshot_signal(row)
    had_image = bool(row.media_image_path)
    had_video = bool(row.media_video_path)

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
        tracker_balance=admin_tracker_balance(db, admin.telegram_user_id),
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

    row.entry_filled_at = None if entry_zone_defined(row.entry_low, row.entry_high) else datetime.now(timezone.utc)

    db.commit()
    db.refresh(row)
    await try_fill_entry_from_market(db, row)
    changes = diff_signal_changes(
        before,
        row,
        image_added=bool(row.media_image_path) and not before.has_image,
        image_removed=before.has_image and not row.media_image_path,
        video_added=bool(row.media_video_path) and not before.has_video,
        video_removed=before.has_video and not row.media_video_path,
    )
    if screenshot and screenshot.filename and had_image and "• Скрин: добавлен" not in changes:
        changes.append("• Скрин: обновлён")
    if video and video.filename and had_video and "• Видео: добавлено" not in changes:
        changes.append("• Видео: обновлено")
    await notify_updated_signal(db, row, changes, actor=admin)
    return signal_to_read(db, row, admin.telegram_user_id)


@router.delete("/{signal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_signal(
    signal_id: int,
    db: Session = Depends(db_session),
    admin: TelegramUser = Depends(require_admin),
) -> None:
    row = db.get(Signal, signal_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signal not found")
    require_signal_owner(row, admin)
    if not signal_awaiting_entry(row):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Удалить можно только до срабатывания входа",
        )
    await notify_deleted_signal(db, row, actor=admin)
    for sup in db.scalars(select(SignalSupplement).where(SignalSupplement.signal_id == signal_id)).all():
        delete_media_files(sup.media_image_path, sup.media_video_path)
    db.execute(delete(SignalSupplement).where(SignalSupplement.signal_id == signal_id))
    delete_media_files(row.media_image_path, row.media_video_path)
    delete_signal_media_dir(signal_id)
    db.delete(row)
    db.commit()


@router.post("/{signal_id}/supplement", response_model=SignalRead)
async def add_supplement(
    signal_id: int,
    comment: str | None = Form(None),
    screenshot: UploadFile | None = File(None),
    video: UploadFile | None = File(None),
    db: Session = Depends(db_session),
    admin: TelegramUser = Depends(require_admin),
) -> SignalRead:
    row = db.get(Signal, signal_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signal not found")
    require_signal_owner(row, admin)
    if not signal_in_trade(row):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Дополнение доступно после срабатывания входа (активный сигнал)",
        )
    if not (comment and comment.strip()) and not (screenshot and screenshot.filename) and not (video and video.filename):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Добавьте комментарий, скрин или видео")

    sup = SignalSupplement(signal_id=signal_id, comment=comment.strip() if comment else None)
    db.add(sup)
    db.flush()

    if screenshot and screenshot.filename:
        sup.media_image_path = await save_supplement_image(row.id, sup.id, screenshot)
    if video and video.filename:
        sup.media_video_path = await save_supplement_video(row.id, sup.id, video)

    db.commit()
    db.refresh(row)
    await notify_signal_supplement(
        db,
        row,
        sup.comment,
        actor=admin,
        has_image=bool(sup.media_image_path),
        has_video=bool(sup.media_video_path),
    )
    return signal_to_read(db, row, admin.telegram_user_id)


@router.post("/{signal_id}/close-market", response_model=SignalRead)
async def close_market(
    signal_id: int,
    db: Session = Depends(db_session),
    admin: TelegramUser = Depends(require_admin),
) -> SignalRead:
    row = db.get(Signal, signal_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signal not found")
    require_signal_owner(row, admin)
    if not signal_in_trade(row):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Закрыть по рынку можно только активный сигнал после входа",
        )
    try:
        await close_signal_at_market(db, row)
    except ValueError as e:
        if str(e) == "no_price":
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Не удалось получить цену для {row.symbol}",
            ) from e
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Сигнал нельзя закрыть") from e
    db.refresh(row)
    return signal_to_read(db, row, admin.telegram_user_id)


@router.post("/{signal_id}/view", response_model=ViewResponse)
def add_view(
    signal_id: int,
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(get_current_user),
) -> ViewResponse:
    row = db.get(Signal, signal_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signal not found")
    require_signal_engagement(row, user)
    count = record_view(db, signal_id, user.telegram_user_id)
    db.commit()
    return ViewResponse(views_count=count)


@router.post("/{signal_id}/like", response_model=LikeResponse)
def like_signal(
    signal_id: int,
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(get_current_user),
) -> LikeResponse:
    row = db.get(Signal, signal_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signal not found")
    require_signal_engagement(row, user)
    result = toggle_like(db, signal_id, user.telegram_user_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signal not found")
    liked, count = result
    db.commit()
    return LikeResponse(liked=liked, likes_count=count)
