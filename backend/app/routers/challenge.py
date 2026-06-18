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
    screenshot: UploadFile | None = File(None),
    account_size: float | None = Form(None),
    db: Session = Depends(db_session),
    admin: TelegramUser = Depends(require_main_feed_publisher),
) -> ChallengeDashboard:
    """Сверка с пропом по скрину: OCR → баланс, этап, торговые дни; Старт фиксируется один раз.

    При первом создании можно передать account_size вручную — будет использован
    как стартовый номинал челленджа (OCR его уже не перезапишет).
    """
    get_or_create_trader(db, admin.telegram_user_id, admin.username)
    ch = get_challenge(db, admin.telegram_user_id)
    is_new = ch is None

    if is_new:
        ch = create_challenge(db, admin.telegram_user_id)
        if account_size is not None and account_size > 0:
            ch.account_size = account_size
            ch.balance = account_size
            ch.day_start_balance = account_size
    elif not can_sync_prop_screenshot_today(ch):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Сверку можно делать раз в сутки. Повторите завтра или дождитесь следующего дня (MSK).",
        )

    has_screenshot = screenshot is not None and bool(screenshot.filename)
    if not has_screenshot and is_new and account_size and account_size > 0:
        # Создание без скрина — достаточно номинала
        db.commit()
        db.refresh(ch)
        return build_dashboard(db, ch)

    if not has_screenshot:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Загрузите скрин с пропа",
        )

    raw = await screenshot.read()  # type: ignore[union-attr]
    try:
        parsed = parse_prop_screenshot_bytes(raw)
    except PropScreenshotParseError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Не удалось прочитать скрин: {exc}",
        ) from exc

    delete_media_files(ch.prop_screenshot_path)
    clear_tracker_screenshot_dir(admin.telegram_user_id)
    ch.prop_screenshot_path = await save_tracker_screenshot(admin.telegram_user_id, screenshot, raw_bytes=raw)  # type: ignore[arg-type]
    apply_prop_screenshot_sync(db, ch, parsed)

    db.commit()
    db.refresh(ch)
    return build_dashboard(db, ch)
