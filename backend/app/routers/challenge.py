from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.challenge_service import build_dashboard, get_or_create_challenge, list_admin_trackers
from app.deps import db_session, get_current_user, require_admin
from app.hashhedge_rules import rules_payload
from app.schemas import ChallengeDashboard, ChallengeUpdate, TelegramUser

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


@router.put("/settings", response_model=ChallengeDashboard)
def update_settings(
    body: ChallengeUpdate,
    db: Session = Depends(db_session),
    admin: TelegramUser = Depends(require_admin),
) -> ChallengeDashboard:
    ch = get_or_create_challenge(db, admin.telegram_user_id)
    if body.account_size is not None:
        ch.account_size = body.account_size
        if body.balance is None:
            ch.balance = ch.day_start_balance = body.account_size
    if body.stage is not None:
        ch.stage = body.stage
    if body.balance is not None:
        ch.balance = body.balance
    if body.reset_day:
        ch.day_start_balance = ch.balance
    db.commit()
    db.refresh(ch)
    return build_dashboard(db, ch)
