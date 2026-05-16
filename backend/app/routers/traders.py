from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import db_session, get_current_user
from app.models import Trader
from app.schemas import TelegramUser, TraderRead

router = APIRouter(prefix="/traders", tags=["traders"])


@router.get("/leaderboard", response_model=list[TraderRead])
def leaderboard(
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(get_current_user),
) -> list[TraderRead]:
    _ = user
    stmt = select(Trader).order_by(Trader.rating_percent.desc(), Trader.wins.desc()).limit(100)
    traders = list(db.scalars(stmt).all())
    result: list[TraderRead] = []
    for rank, t in enumerate(traders, start=1):
        total = t.wins + t.losses
        win_rate = round(t.wins / total * 100, 1) if total > 0 else 0.0
        result.append(
            TraderRead(
                telegram_id=t.telegram_id,
                username=t.username,
                rating_percent=t.rating_percent,
                wins=t.wins,
                losses=t.losses,
                rank=rank,
                win_rate=win_rate,
            )
        )
    return result
