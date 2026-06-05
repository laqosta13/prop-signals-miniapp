from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.data_cleanup import purge_all_published_content
from app.deps import db_session, require_super_admin
from app.schemas import TelegramUser

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/purge-published")
def purge_published(
    _admin: TelegramUser = Depends(require_super_admin),
    db: Session = Depends(db_session),
) -> dict[str, object]:
    """Удалить все сигналы, новости и отзывы (подписки и платежи не трогаем)."""
    purge_all_published_content(db)
    db.commit()
    return {
        "ok": True,
        "purged": ["signals", "cult_channel_signals", "news", "reviews"],
        "reset": [
            "trader_stats",
            "cult_channel_stats",
            "cult_candidate_stats",
            "admin_trackers",
            "trader_roster_overrides",
        ],
    }
