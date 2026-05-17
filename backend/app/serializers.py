from sqlalchemy.orm import Session

from app.engagement import user_liked
from app.media_storage import public_url
from app.models import Signal, Trader
from app.schemas import SignalRead, TraderDayStat, TraderRead


def trader_avatar_url(trader: Trader | None) -> str | None:
    if trader and trader.avatar_path:
        return public_url(trader.avatar_path)
    return None


def signal_to_read(db: Session, signal: Signal, viewer_id: int | None = None) -> SignalRead:
    trader = db.get(Trader, signal.author_telegram_id)
    liked = user_liked(db, signal.id, viewer_id) if viewer_id else False
    return SignalRead(
        id=signal.id,
        created_at=signal.created_at,
        closed_at=signal.closed_at,
        symbol=signal.symbol,
        direction=signal.direction,
        entry_low=signal.entry_low,
        entry_high=signal.entry_high,
        stop_loss=signal.stop_loss,
        take_profits=signal.take_profits,
        comment=signal.comment,
        status=signal.status,
        points_percent=signal.points_percent or 1.0,
        leverage=signal.leverage,
        risk_percent=signal.risk_percent,
        tracker_balance=signal.tracker_balance,
        realized_pnl=signal.realized_pnl,
        views_count=signal.views_count or 0,
        likes_count=signal.likes_count or 0,
        liked_by_me=liked,
        author_telegram_id=signal.author_telegram_id,
        author_username=signal.author_username,
        media_image_url=public_url(signal.media_image_path),
        media_video_url=public_url(signal.media_video_path),
        author_avatar_url=trader_avatar_url(trader),
    )


def trader_to_read(
    t: Trader, rank: int, win_rate: float, daily_stats: list[TraderDayStat] | None = None
) -> TraderRead:
    return TraderRead(
        telegram_id=t.telegram_id,
        username=t.username,
        rating_percent=t.rating_percent or 0.0,
        total_pnl_usd=t.total_pnl_usd or 0.0,
        wins=t.wins or 0,
        losses=t.losses or 0,
        rank=rank,
        win_rate=win_rate,
        avatar_url=trader_avatar_url(t),
        daily_stats=daily_stats or [],
    )
