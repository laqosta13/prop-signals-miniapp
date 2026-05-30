from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.deps import db_session, get_current_user, require_admin
from app.leaderboard_service import build_leaderboard
from app.models import Trader
from app.rank_service import activate_shield, confirm_rank, ensure_rank_fields, needs_confirm_prompt
from app.schemas import TelegramUser, TraderRankRead, TraderRead
from app.serializers import trader_rank_read
from app.signal_service import get_or_create_trader

router = APIRouter(prefix="/traders", tags=["traders"])


@router.get("/leaderboard", response_model=list[TraderRead])
def leaderboard(
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(get_current_user),
) -> list[TraderRead]:
    _ = user
    result = build_leaderboard(db)
    db.commit()
    return result


@router.get("/me/rank-pending")
def my_rank_pending(
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(require_admin),
) -> dict:
    trader = get_or_create_trader(db, user.telegram_user_id, user.username)
    ensure_rank_fields(trader)
    db.commit()
    return {"needs_confirm": needs_confirm_prompt(trader), "rank": trader_rank_read(trader)}


@router.post("/me/rank/confirm", response_model=TraderRankRead)
def confirm_my_rank(
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(require_admin),
) -> TraderRankRead:
    trader = get_or_create_trader(db, user.telegram_user_id, user.username)
    confirm_rank(trader)
    db.commit()
    db.refresh(trader)
    return trader_rank_read(trader)


@router.post("/me/rank/shield", response_model=TraderRankRead)
def activate_my_shield(
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(require_admin),
) -> TraderRankRead:
    trader = get_or_create_trader(db, user.telegram_user_id, user.username)
    try:
        activate_shield(trader)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    db.commit()
    db.refresh(trader)
    return trader_rank_read(trader)


@router.get("/{telegram_id}/rank", response_model=TraderRankRead)
def trader_rank_profile(
    telegram_id: int,
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(get_current_user),
) -> TraderRankRead:
    _ = user
    if telegram_id not in settings.admin_id_set:
        raise HTTPException(status_code=404, detail="trader_not_found")
    trader = db.get(Trader, telegram_id)
    if trader is None:
        trader = get_or_create_trader(db, telegram_id, None)
    ensure_rank_fields(trader)
    db.commit()
    return trader_rank_read(trader)
