"""Очистка тестовых данных и опубликованного контента."""

from __future__ import annotations

import shutil

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.media_storage import clear_tracker_screenshot_dir, delete_media_files, media_root
from app.models import (
    CultCandidate,
    CultChannel,
    CultChannelSignal,
    NewsPost,
    Review,
    Signal,
    SignalCopyTrade,
    SignalLike,
    SignalSupplement,
    SignalView,
    Trader,
    TraderRosterOverride,
    UserChallenge,
)
from app.rank_constants import INITIAL_RANK_ID


def _clear_media_subdir(name: str) -> None:
    path = media_root() / name
    if path.is_dir():
        shutil.rmtree(path, ignore_errors=True)
        path.mkdir(parents=True, exist_ok=True)


def _purge_cult_channel_content(db: Session) -> None:
    db.execute(delete(CultChannelSignal))
    for ch in db.scalars(select(CultChannel)):
        ch.rating_percent = 0.0
        ch.wins = 0
        ch.losses = 0


def _purge_cult_candidate_stats(db: Session) -> None:
    for row in db.scalars(select(CultCandidate)):
        row.rating_percent = 0.0
        row.wins = 0
        row.losses = 0


def _purge_signals_media_and_rows(db: Session) -> None:
    for s in db.scalars(select(Signal)):
        delete_media_files(s.media_image_path, s.media_video_path)
    for sup in db.scalars(select(SignalSupplement)):
        delete_media_files(sup.media_image_path, sup.media_video_path)
    _clear_media_subdir("signals")
    db.execute(delete(SignalCopyTrade))
    db.execute(delete(SignalLike))
    db.execute(delete(SignalView))
    db.execute(delete(SignalSupplement))
    db.execute(delete(Signal))


def _purge_reviews_only(db: Session) -> None:
    for row in db.scalars(select(Review)):
        delete_media_files(row.image_path)
    _clear_media_subdir("reviews")
    db.execute(delete(Review))


def _purge_news_and_reviews(db: Session) -> None:
    pinned_ids = {
        post.id for post in db.scalars(select(NewsPost).where(NewsPost.pinned.is_(True)))
    }
    for post in db.scalars(select(NewsPost).where(NewsPost.pinned.is_(False))):
        delete_media_files(post.image_path, post.video_path)
    db.execute(delete(NewsPost).where(NewsPost.pinned.is_(False)))

    news_root = media_root() / "news"
    if news_root.is_dir():
        for item in news_root.iterdir():
            if item.is_dir() and item.name.isdigit() and int(item.name) not in pinned_ids:
                shutil.rmtree(item, ignore_errors=True)

    _purge_reviews_only(db)


def _reset_trader_leaderboard(db: Session, *, reset_ranks: bool = False) -> None:
    for t in db.scalars(select(Trader)):
        t.wins = 0
        t.losses = 0
        t.rating_percent = 0.0
        t.total_pnl_usd = 0.0
        if reset_ranks:
            t.current_rank_id = INITIAL_RANK_ID
            t.weekly_pct = 0.0
            t.consecutive_loss_weeks = 0
            t.rank_history_json = None


def delete_all_trackers(db: Session) -> None:
    """Удалить все трекеры Hash Hedge (включая админов). Трекер создаётся только вручную через «+»."""
    for ch in list(db.scalars(select(UserChallenge))):
        delete_media_files(ch.prop_screenshot_path)
        clear_tracker_screenshot_dir(ch.telegram_user_id)
        db.delete(ch)


def purge_signals_and_reset_ratings(db: Session) -> None:
    """Удалить все сигналы и обнулить рейтинг трейдеров (трекеры не трогаем)."""
    _purge_signals_media_and_rows(db)
    _reset_trader_leaderboard(db)


def purge_all_signals(db: Session) -> None:
    _purge_signals_media_and_rows(db)
    _reset_trader_leaderboard(db)
    delete_all_trackers(db)


def _reset_trader_roster_overrides(db: Session) -> None:
    db.execute(delete(TraderRosterOverride))


def purge_all_published_content(db: Session) -> None:
    """Сигналы, CULT, новости, отзывы, медиа; рейтинг, трекеры и ротация — сброс."""
    _purge_signals_media_and_rows(db)
    _purge_cult_channel_content(db)
    _purge_cult_candidate_stats(db)
    _purge_news_and_reviews(db)
    _reset_trader_leaderboard(db, reset_ranks=True)
    delete_all_trackers(db)
    _reset_trader_roster_overrides(db)


def purge_published_except_news(db: Session) -> None:
    """Сигналы, CULT, отзывы; новости не трогаем; рейтинг, трекеры и ротация — сброс."""
    _purge_signals_media_and_rows(db)
    _purge_cult_channel_content(db)
    _purge_cult_candidate_stats(db)
    _purge_reviews_only(db)
    _reset_trader_leaderboard(db, reset_ranks=True)
    delete_all_trackers(db)
    _reset_trader_roster_overrides(db)
