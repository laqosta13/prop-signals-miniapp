"""Очистка тестовых данных и опубликованного контента."""

from __future__ import annotations

import shutil

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.config import settings
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
    UserChallenge,
)
from app.rank_constants import DEFAULT_RANK_ID

_TRACKER_DEFAULT = 10_000.0


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


def _purge_news_and_reviews(db: Session) -> None:
    for post in db.scalars(select(NewsPost)):
        delete_media_files(post.image_path, post.video_path)
    for row in db.scalars(select(Review)):
        delete_media_files(row.image_path)
    _clear_media_subdir("news")
    _clear_media_subdir("reviews")
    db.execute(delete(NewsPost))
    db.execute(delete(Review))


def _reset_trader_leaderboard(db: Session, *, reset_ranks: bool = False) -> None:
    for t in db.scalars(select(Trader)):
        t.wins = 0
        t.losses = 0
        t.rating_percent = 0.0
        t.total_pnl_usd = 0.0
        if reset_ranks:
            t.current_rank_id = DEFAULT_RANK_ID
            t.weekly_pct = 0.0
            t.is_confirmed = False
            t.confirm_deadline = None
            t.consecutive_loss_weeks = 0
            t.shield_used_this_month = False
            t.shield_active = False
            t.rank_applied_this_week = False
            t.rank_history_json = None


def _reset_admin_trackers(db: Session) -> None:
    admin_ids = settings.all_admin_id_set
    for ch in list(db.scalars(select(UserChallenge))):
        if ch.telegram_user_id not in admin_ids:
            db.delete(ch)
    for aid in admin_ids:
        ch = db.get(UserChallenge, aid)
        if ch is None:
            db.add(
                UserChallenge(
                    telegram_user_id=aid,
                    account_size=_TRACKER_DEFAULT,
                    balance=_TRACKER_DEFAULT,
                    day_start_balance=_TRACKER_DEFAULT,
                    stage=1,
                    trading_days=0,
                )
            )
        else:
            ch.account_size = _TRACKER_DEFAULT
            ch.balance = _TRACKER_DEFAULT
            ch.day_start_balance = _TRACKER_DEFAULT
            ch.stage = 1
            ch.trading_days = 0
            delete_media_files(ch.prop_screenshot_path)
            ch.prop_screenshot_path = None
        clear_tracker_screenshot_dir(aid)


def purge_signals_and_reset_ratings(db: Session) -> None:
    """Удалить все сигналы и обнулить рейтинг трейдеров (трекеры не трогаем)."""
    _purge_signals_media_and_rows(db)
    _reset_trader_leaderboard(db)


def purge_all_signals(db: Session) -> None:
    _purge_signals_media_and_rows(db)
    _reset_trader_leaderboard(db)
    _reset_admin_trackers(db)


def purge_all_published_content(db: Session) -> None:
    """Сигналы, CULT, новости, отзывы, медиа; рейтинг и трекеры админов — сброс."""
    _purge_signals_media_and_rows(db)
    _purge_cult_channel_content(db)
    _purge_cult_candidate_stats(db)
    _purge_news_and_reviews(db)
    _reset_trader_leaderboard(db, reset_ranks=True)
    _reset_admin_trackers(db)
