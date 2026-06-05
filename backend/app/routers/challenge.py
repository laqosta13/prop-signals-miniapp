from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.challenge_service import (
    apply_prop_balance_sync,
    build_dashboard,
    create_challenge,
    get_challenge,
    get_or_create_challenge,
    list_admin_trackers,
)
from app.signal_service import get_or_create_trader
from app.deps import db_session, get_current_user, require_main_feed_publisher
from app.hashhedge_rules import rules_payload
from app.media_storage import clear_tracker_screenshot_dir, delete_media_files, save_tracker_screenshot
from app.schemas import ChallengeDashboard, TelegramUser

router = APIRouter(prefix="/challenge", tags=["challenge"])


def _form_bool(raw: str | None) -> bool:
    return (raw or "").strip().lower() in ("1", "true", "yes", "on")


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


@router.get("/my-tracker", response_model=ChallengeDashboard)
def my_tracker(
    exclude_signal_id: int | None = Query(None, ge=1),
    db: Session = Depends(db_session),
    admin: TelegramUser = Depends(require_main_feed_publisher),
) -> ChallengeDashboard:
    """Текущий трекер — для формы сигнала (баланс и размер счёта)."""
    ch = get_challenge(db, admin.telegram_user_id)
    if ch is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="tracker_not_configured")
    db.commit()
    return build_dashboard(db, ch, exclude_signal_id=exclude_signal_id)


@router.put("/settings", response_model=ChallengeDashboard)
async def update_settings(
    account_size: str | None = Form(None),
    stage: str | None = Form(None),
    balance: str | None = Form(None),
    remove_screenshot: str | None = Form(None),
    screenshot: UploadFile | None = File(None),
    db: Session = Depends(db_session),
    admin: TelegramUser = Depends(require_main_feed_publisher),
) -> ChallengeDashboard:
    """Настройки трекера: баланс с пропа меняет balance; старт (account_size) и торговые дни сохраняются."""
    get_or_create_trader(db, admin.telegram_user_id, admin.username)
    ch = get_challenge(db, admin.telegram_user_id)
    if ch is None:
        ch = create_challenge(db, admin.telegram_user_id)

    if stage is not None and stage.strip():
        stage_n = int(stage)
        if stage_n < 1 or stage_n > 3:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Этап должен быть от 1 до 3")
        ch.stage = stage_n

    balance_provided = balance is not None and balance.strip()
    if balance_provided:
        try:
            new_balance = float(balance.replace(",", "."))
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Некорректный баланс",
            ) from exc
        if new_balance < 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Баланс не может быть отрицательным")
        apply_prop_balance_sync(db, ch, new_balance)
    elif account_size is not None and account_size.strip():
        ch.account_size = float(account_size.replace(",", "."))

    if _form_bool(remove_screenshot):
        delete_media_files(ch.prop_screenshot_path)
        clear_tracker_screenshot_dir(admin.telegram_user_id)
        ch.prop_screenshot_path = None

    if screenshot and screenshot.filename:
        delete_media_files(ch.prop_screenshot_path)
        clear_tracker_screenshot_dir(admin.telegram_user_id)
        ch.prop_screenshot_path = await save_tracker_screenshot(admin.telegram_user_id, screenshot)

    db.commit()
    db.refresh(ch)
    return build_dashboard(db, ch)
