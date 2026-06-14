from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.challenge_service import (
    apply_prop_screenshot_sync,
    build_dashboard,
    build_signal_form_context,
    can_sync_prop_screenshot_today,
    create_challenge,
    get_challenge,
    list_admin_trackers,
    set_account_size,
)
from app.prop_screenshot_parser import PropScreenshotParseError, parse_prop_screenshot_bytes
from app.signal_service import get_or_create_trader
from app.deps import db_session, get_current_user, require_main_feed_publisher
from app.hashhedge_rules import rules_payload
from app.media_storage import clear_tracker_screenshot_dir, delete_media_files, save_tracker_screenshot
from app.schemas import ChallengeDashboard, SignalFormSnapshot, TelegramUser

router = APIRouter(prefix="/challenge", tags=["challenge"])


@router.get("/rules")
def get_rules() -> dict:
    return rules_payload()


@router.get("/trackers", response_model=list[ChallengeDashboard])
def trackers(
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(get_current_user),
) -> list[ChallengeDashboard]:
    _ = user
    rows = list_admin_trackers(db)
    db.commit()
    return rows


@router.get("/my-tracker", response_model=SignalFormSnapshot)
def my_tracker(
    exclude_signal_id: int | None = Query(None, ge=1),
    db: Session = Depends(db_session),
    admin: TelegramUser = Depends(require_main_feed_publisher),
) -> SignalFormSnapshot:
    """Контекст формы сигнала: ранг и пул; лимиты челленджа — только при добавленном трекере."""
    db.commit()
    return build_signal_form_context(db, admin.telegram_user_id, exclude_signal_id=exclude_signal_id)


@router.put("/settings", response_model=ChallengeDashboard)
async def update_settings(
    account_size: float | None = Form(None, ge=100, le=1_000_000),
    screenshot: UploadFile | None = File(None),
    db: Session = Depends(db_session),
    admin: TelegramUser = Depends(require_main_feed_publisher),
) -> ChallengeDashboard:
    """Обновить трекер: account_size вводится вручную, баланс/этап/дни — из скрина."""
    has_screenshot = bool(screenshot and screenshot.filename)
    if not account_size and not has_screenshot:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Укажите размер счёта или загрузите скрин с пропа",
        )

    get_or_create_trader(db, admin.telegram_user_id, admin.username)
    ch = get_challenge(db, admin.telegram_user_id)
    is_new = ch is None
    if is_new:
        ch = create_challenge(db, admin.telegram_user_id)

    if account_size:
        set_account_size(db, ch, account_size)

    if has_screenshot:
        if not is_new and not can_sync_prop_screenshot_today(ch):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Сверку можно делать раз в сутки. Повторите завтра или дождитесь следующего дня (MSK).",
            )
        raw = await screenshot.read()
        try:
            parsed = parse_prop_screenshot_bytes(raw)
        except PropScreenshotParseError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Не удалось прочитать скрин: {exc}",
            ) from exc
        delete_media_files(ch.prop_screenshot_path)
        clear_tracker_screenshot_dir(admin.telegram_user_id)
        ch.prop_screenshot_path = await save_tracker_screenshot(admin.telegram_user_id, screenshot, raw_bytes=raw)
        apply_prop_screenshot_sync(db, ch, parsed)

    db.commit()
    db.refresh(ch)
    return build_dashboard(db, ch)
