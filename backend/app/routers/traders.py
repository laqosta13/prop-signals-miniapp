from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.deps import db_session, get_current_user
from app.leaderboard_service import build_leaderboard
from app.schemas import TelegramUser, TraderRead

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
