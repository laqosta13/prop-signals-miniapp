"""Быстрая сериализация ленты: без N+1 запросов."""

from __future__ import annotations

from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.media_storage import public_url
from app.models import Signal, SignalLike, SignalSupplement, Trader
from app.schemas import SignalRead, SignalSupplementRead
from app.serializers import trader_avatar_url, trader_display_name, trader_login

FEED_SIGNAL_LIMIT = 80
MAX_SUPPLEMENTS_PER_SIGNAL = 8


def signals_list_read(db: Session, signals: list[Signal], viewer_id: int | None) -> list[SignalRead]:
    if not signals:
        return []

    signal_ids = [s.id for s in signals]
    author_ids = {s.author_telegram_id for s in signals}

    traders = {
        t.telegram_id: t
        for t in db.scalars(select(Trader).where(Trader.telegram_id.in_(author_ids))).all()
    }

    supplements_map: dict[int, list[SignalSupplementRead]] = defaultdict(list)
    for sup in db.scalars(
        select(SignalSupplement)
        .where(SignalSupplement.signal_id.in_(signal_ids))
        .order_by(SignalSupplement.created_at)
    ).all():
        if len(supplements_map[sup.signal_id]) >= MAX_SUPPLEMENTS_PER_SIGNAL:
            continue
        supplements_map[sup.signal_id].append(
            SignalSupplementRead(
                id=sup.id,
                created_at=sup.created_at,
                comment=sup.comment,
                media_image_url=public_url(sup.media_image_path),
                media_video_url=public_url(sup.media_video_path),
            )
        )

    liked_ids: set[int] = set()
    if viewer_id and signal_ids:
        liked_ids = set(
            db.scalars(
                select(SignalLike.signal_id).where(
                    SignalLike.telegram_user_id == viewer_id,
                    SignalLike.signal_id.in_(signal_ids),
                )
            ).all()
        )

    out: list[SignalRead] = []
    for s in signals:
        trader = traders.get(s.author_telegram_id)
        login = trader_login(trader, s.author_username)
        out.append(
            SignalRead(
                id=s.id,
                created_at=s.created_at,
                closed_at=s.closed_at,
                symbol=s.symbol,
                direction=s.direction,
                entry_low=s.entry_low,
                entry_high=s.entry_high,
                stop_loss=s.stop_loss,
                take_profits=s.take_profits,
                comment=s.comment,
                status=s.status,
                points_percent=s.points_percent or 1.0,
                leverage=s.leverage,
                risk_percent=s.risk_percent,
                tracker_balance=s.tracker_balance,
                realized_pnl=s.realized_pnl,
                entry_filled_at=s.entry_filled_at,
                published_market_price=s.published_market_price,
                published_market_source=s.published_market_source,
                views_count=s.views_count or 0,
                likes_count=s.likes_count or 0,
                liked_by_me=s.id in liked_ids,
                author_telegram_id=s.author_telegram_id,
                author_username=login,
                author_display_name=trader_display_name(trader, login),
                media_image_url=public_url(s.media_image_path),
                media_video_url=public_url(s.media_video_path),
                author_avatar_url=trader_avatar_url(trader),
                supplements=supplements_map.get(s.id, []),
            )
        )
    return out
