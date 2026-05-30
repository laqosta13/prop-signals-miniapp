from sqlalchemy import select
from sqlalchemy.orm import Session

from app.engagement import user_liked
from app.media_storage import public_url
from app.models import NewsPost, Review, Signal, SignalSupplement, Trader
from app.rank_service import trader_rank_payload
from app.trader_stats import signal_realized_pnl_for_read
from app.schemas import (
    NewsRead,
    RankHistoryEntryRead,
    ReviewRead,
    SignalRead,
    SignalSupplementRead,
    TraderDayStat,
    TraderRankRead,
    TraderRead,
)


def trader_display_name(trader: Trader | None, username: str | None = None) -> str | None:
    if trader:
        parts = [trader.first_name, trader.last_name]
        name = " ".join(p.strip() for p in parts if p and str(p).strip())
        if name:
            return name
    return None


def trader_login(trader: Trader | None, fallback_username: str | None = None) -> str | None:
    if trader and trader.username:
        return trader.username
    return fallback_username


def trader_avatar_url(trader: Trader | None) -> str | None:
    if trader and trader.avatar_path:
        return public_url(trader.avatar_path)
    return None


def signal_display_number(signal: Signal) -> int:
    return signal.number if signal.number is not None else signal.id


def _supplements_read(db: Session, signal_id: int) -> list[SignalSupplementRead]:
    rows = db.scalars(
        select(SignalSupplement).where(SignalSupplement.signal_id == signal_id).order_by(SignalSupplement.created_at)
    ).all()
    return [
        SignalSupplementRead(
            id=s.id,
            created_at=s.created_at,
            comment=s.comment,
            media_image_url=public_url(s.media_image_path),
            media_video_url=public_url(s.media_video_path),
        )
        for s in rows
    ]


def signal_to_read(db: Session, signal: Signal, viewer_id: int | None = None) -> SignalRead:
    from app.signal_service import get_or_create_trader

    trader = get_or_create_trader(db, signal.author_telegram_id, signal.author_username)
    liked = user_liked(db, signal.id, viewer_id) if viewer_id else False
    login = trader_login(trader, signal.author_username)
    return SignalRead(
        id=signal.id,
        number=signal_display_number(signal),
        created_at=signal.created_at,
        closed_at=signal.closed_at,
        close_reason=signal.close_reason,
        closed_exit_price=signal.closed_exit_price,
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
        account_size=signal.account_size,
        realized_pnl=signal_realized_pnl_for_read(signal),
        entry_filled_at=signal.entry_filled_at,
        published_market_price=signal.published_market_price,
        published_market_source=signal.published_market_source,
        views_count=signal.views_count or 0,
        likes_count=signal.likes_count or 0,
        liked_by_me=liked,
        author_telegram_id=signal.author_telegram_id,
        author_username=login,
        author_display_name=trader_display_name(trader, login),
        media_image_url=public_url(signal.media_image_path),
        media_video_url=public_url(signal.media_video_path),
        author_avatar_url=trader_avatar_url(trader),
        supplements=_supplements_read(db, signal.id),
    )


def trader_rank_read(t: Trader, *, include_history: bool = False) -> TraderRankRead:
    p = trader_rank_payload(t, include_history=include_history)
    history = [RankHistoryEntryRead(**h) for h in p.get("rank_history", [])]
    return TraderRankRead(
        current_rank_id=p["current_rank_id"],
        current_rank_name=p["current_rank_name"],
        weekly_pct=p["weekly_pct"],
        is_confirmed=p["is_confirmed"],
        confirm_deadline=p.get("confirm_deadline"),
        consecutive_loss_weeks=p["consecutive_loss_weeks"],
        shield_used_this_month=p["shield_used_this_month"],
        shield_active=p["shield_active"],
        rank_applied_this_week=p["rank_applied_this_week"],
        pending_rank_penalty=p["pending_rank_penalty"],
        rank_history=history,
    )


def trader_to_read(
    t: Trader, rank: int, win_rate: float, daily_stats: list[TraderDayStat] | None = None
) -> TraderRead:
    return TraderRead(
        telegram_id=t.telegram_id,
        username=t.username,
        display_name=trader_display_name(t, t.username),
        rating_percent=t.rating_percent or 0.0,
        total_pnl_usd=t.total_pnl_usd or 0.0,
        wins=t.wins or 0,
        losses=t.losses or 0,
        rank=rank,
        win_rate=win_rate,
        avatar_url=trader_avatar_url(t),
        daily_stats=daily_stats or [],
        trader_rank=trader_rank_read(t),
        is_aggregate=False,
    )


def _author_profile(db: Session, telegram_id: int, fallback_username: str | None) -> tuple[str | None, str | None, str | None]:
    trader = db.get(Trader, telegram_id)
    login = trader_login(trader, fallback_username)
    return trader_display_name(trader, login), login, trader_avatar_url(trader)


def review_to_read(db: Session, row: Review, viewer_id: int) -> ReviewRead:
    display, login, avatar = _author_profile(db, row.author_telegram_id, row.author_username)
    return ReviewRead(
        id=row.id,
        created_at=row.created_at,
        updated_at=row.updated_at,
        author_telegram_id=row.author_telegram_id,
        author_username=login,
        author_display_name=display,
        author_avatar_url=avatar,
        text=row.text,
        rating=row.rating,
        image_url=public_url(row.image_path),
        is_mine=row.author_telegram_id == viewer_id,
    )


def news_to_read(db: Session, row: NewsPost) -> NewsRead:
    from app.schemas import NewsLinkPreview

    display, _, _ = _author_profile(db, row.author_telegram_id, None)
    link = None
    if row.link_url:
        link = NewsLinkPreview(
            url=row.link_url,
            title=row.link_title,
            description=row.link_description,
            image_url=row.link_image_url,
        )
    return NewsRead(
        id=row.id,
        created_at=row.created_at,
        updated_at=row.updated_at,
        title=row.title,
        body=row.body,
        image_url=public_url(row.image_path),
        video_url=public_url(row.video_path),
        link=link,
        author_telegram_id=row.author_telegram_id,
        author_display_name=display,
    )
