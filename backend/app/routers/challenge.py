from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.challenge_service import build_dashboard, get_or_create_challenge, list_admin_trackers
from app.deps import db_session, get_current_user, require_admin
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


@router.put("/settings", response_model=ChallengeDashboard)
async def update_settings(
    account_size: str | None = Form(None),
    stage: str | None = Form(None),
    balance: str | None = Form(None),
    reset_day: str | None = Form(None),
    remove_screenshot: str | None = Form(None),
    screenshot: UploadFile | None = File(None),
    db: Session = Depends(db_session),
    admin: TelegramUser = Depends(require_admin),
) -> ChallengeDashboard:
    """Настройки трекера: коррекция баланса с пропа не сбрасывает прогресс (account_size, trading_days)."""
    ch = get_or_create_challenge(db, admin.telegram_user_id)

    if account_size is not None and account_size.strip():
        ch.account_size = float(account_size)

    if stage is not None and stage.strip():
        stage_n = int(stage)
        if stage_n < 1 or stage_n > 3:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Этап должен быть от 1 до 3")
        ch.stage = stage_n

    if balance is not None and balance.strip():
        ch.balance = round(float(balance), 2)

    if _form_bool(reset_day):
        ch.day_start_balance = ch.balance

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
