from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.data_cleanup import purge_all_published_content, purge_published_except_news
from app.deps import db_session, require_super_admin
from app.schemas import TelegramUser

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/purge-published")
def purge_published(
    keep_news: bool = False,
    _admin: TelegramUser = Depends(require_super_admin),
    db: Session = Depends(db_session),
) -> dict[str, object]:
    """Удалить сигналы, CULT и отзывы; при keep_news=true новости не трогаем."""
    if keep_news:
        purge_published_except_news(db)
        purged = ["signals", "cult_channel_signals", "reviews"]
    else:
        purge_all_published_content(db)
        purged = ["signals", "cult_channel_signals", "news", "reviews"]
    db.commit()
    return {
        "ok": True,
        "keep_news": keep_news,
        "purged": purged,
        "reset": [
            "trader_stats",
            "cult_channel_stats",
            "cult_candidate_stats",
            "admin_trackers",
            "trader_roster_overrides",
        ],
    }
