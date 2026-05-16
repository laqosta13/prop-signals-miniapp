from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import db_session, get_current_user
from app.models import Trader
from app.schemas import TelegramUser, TraderRead
from app.serializers import trader_to_read
from app.telegram_avatar import ensure_trader_avatar

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
        if not t.avatar_path:
            path = ensure_trader_avatar(t.telegram_id)
            if path:
                t.avatar_path = path
        total = (t.wins or 0) + (t.losses or 0)
        win_rate = round((t.wins or 0) / total * 100, 1) if total > 0 else 0.0
        result.append(trader_to_read(t, rank, win_rate))
    db.commit()
    return result
