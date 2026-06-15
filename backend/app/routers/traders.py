from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.deps import db_session, get_current_user, require_admin, require_super_admin
from app.leaderboard_service import build_fired_leaderboard, build_leaderboard, build_roster_demoted_admins, fired_trader_ids
from app.models import Trader
from app.pool_service import (
    CANDIDATES_SHARE,
    PROJECT_SHARE,
    TRADERS_SHARE,
    get_pool_balance,
)
from app.rank_service import ensure_rank_fields
from app.schemas import TelegramUser, TraderRankRead, TraderRead, TraderRosterBody
from app.serializers import trader_rank_read
from app.signal_service import get_or_create_trader
from app.trader_roster_service import clear_roster_override, set_roster_override
from app.volnovoi_account import build_volnovoi_read, is_volnovoi_account

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


@router.get("/fired-leaderboard", response_model=list[TraderRead])
def fired_leaderboard(
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(get_current_user),
) -> list[TraderRead]:
    _ = user
    result = build_fired_leaderboard(db)
    db.commit()
    return result


@router.get("/roster-demoted", response_model=list[TraderRead])
def roster_demoted_admins(
    db: Session = Depends(db_session),
    _admin: TelegramUser = Depends(get_current_user),
) -> list[TraderRead]:
    """Админы, переведённые в блок кандидатов (для вкладки ТОП)."""
    result = build_roster_demoted_admins(db)
    db.commit()
    return result


@router.get("/pool")
def pool_stats(
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(get_current_user),
) -> dict:
    _ = user
    from app.models import Signal
    from app.trader_stats import closed_signal_move_pct

    signals = db.scalars(
        select(Signal)
        .where(
            Signal.status.in_(("win", "lose")),
            Signal.is_cult_candidate.is_(False),
        )
        .order_by(Signal.closed_at.asc())
    ).all()

    balance = POOL_INITIAL_USD
    breakdown = []
    for sig in signals:
        move = closed_signal_move_pct(sig)
        before = balance
        balance = round(balance * (1.0 + move / 100.0), 2)
        breakdown.append({
            "signal_id": sig.id,
            "move_pct": round(move, 4),
            "delta_usd": round(balance - before, 2),
            "pool_after": balance,
            "closed_exit_price": sig.closed_exit_price,
            "realized_pnl": sig.realized_pnl,
        })

    balance = max(0.0, balance)
    return {
        "balance": balance,
        "project_usd": round(balance * PROJECT_SHARE, 2),
        "traders_usd": round(balance * TRADERS_SHARE, 2),
        "candidates_usd": round(balance * CANDIDATES_SHARE, 2),
        "signals_count": len(signals),
        "breakdown": breakdown,
    }


@router.put("/{telegram_id}/roster")
def set_trader_roster(
    telegram_id: int,
    body: TraderRosterBody,
    db: Session = Depends(db_session),
    _admin: TelegramUser = Depends(require_super_admin),
) -> dict[str, object]:
    """Ротация трейдера: top / candidate / fired (главный админ)."""
    try:
        set_roster_override(db, telegram_id, body.section)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    get_or_create_trader(db, telegram_id, None)
    db.commit()
    return {"ok": True, "telegram_id": telegram_id, "section": body.section}


@router.delete("/{telegram_id}/roster", status_code=status.HTTP_204_NO_CONTENT)
def reset_trader_roster(
    telegram_id: int,
    db: Session = Depends(db_session),
    _admin: TelegramUser = Depends(require_super_admin),
) -> None:
    """Сброс ручной ротации — автоматические правила."""
    try:
        clear_roster_override(db, telegram_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    db.commit()


@router.get("/{telegram_id}/rank", response_model=TraderRankRead)
def trader_rank_profile(
    telegram_id: int,
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(get_current_user),
) -> TraderRankRead:
    _ = user
    if is_volnovoi_account(telegram_id):
        row = build_volnovoi_read(db)
        if row is None or row.trader_rank is None:
            raise HTTPException(status_code=404, detail="trader_not_found")
        return row.trader_rank
    if telegram_id not in settings.all_admin_id_set and telegram_id not in fired_trader_ids(db):
        raise HTTPException(status_code=404, detail="trader_not_found")
    trader = db.get(Trader, telegram_id)
    if trader is None:
        trader = get_or_create_trader(db, telegram_id, None)
    ensure_rank_fields(trader)
    db.commit()
    return trader_rank_read(trader)
