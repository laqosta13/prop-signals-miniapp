"""Очистка тестовых данных и трекеров не-админов."""

from __future__ import annotations

import shutil

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.config import settings
from app.media_storage import delete_media_files, media_root
from app.models import Signal, SignalLike, SignalSupplement, SignalView, Trader, UserChallenge


def purge_signals_and_reset_ratings(db: Session) -> None:
    """Удалить все сигналы и обнулить рейтинг трейдеров (трекеры не трогаем)."""
    for s in db.scalars(select(Signal)):
        delete_media_files(s.media_image_path, s.media_video_path)
    for sup in db.scalars(select(SignalSupplement)):
        delete_media_files(sup.media_image_path, sup.media_video_path)

    signals_dir = media_root() / "signals"
    if signals_dir.is_dir():
        shutil.rmtree(signals_dir, ignore_errors=True)
        signals_dir.mkdir(parents=True, exist_ok=True)

    db.execute(delete(SignalLike))
    db.execute(delete(SignalView))
    db.execute(delete(SignalSupplement))
    db.execute(delete(Signal))

    for t in db.scalars(select(Trader)):
        t.wins = 0
        t.losses = 0
        t.rating_percent = 0.0
        t.total_pnl_usd = 0.0


def purge_all_signals(db: Session) -> None:
    for s in db.scalars(select(Signal)):
        delete_media_files(s.media_image_path, s.media_video_path)
    for sup in db.scalars(select(SignalSupplement)):
        delete_media_files(sup.media_image_path, sup.media_video_path)
    signals_dir = media_root() / "signals"
    if signals_dir.is_dir():
        shutil.rmtree(signals_dir, ignore_errors=True)
        signals_dir.mkdir(parents=True, exist_ok=True)

    db.execute(delete(SignalLike))
    db.execute(delete(SignalView))
    db.execute(delete(SignalSupplement))
    db.execute(delete(Signal))

    for t in db.scalars(select(Trader)):
        t.wins = 0
        t.losses = 0
        t.rating_percent = 0.0
        t.total_pnl_usd = 0.0

    admin_ids = settings.admin_id_set
    for ch in list(db.scalars(select(UserChallenge))):
        if ch.telegram_user_id not in admin_ids:
            db.delete(ch)

    default = 10_000.0
    for aid in admin_ids:
        ch = db.get(UserChallenge, aid)
        if ch is None:
            db.add(
                UserChallenge(
                    telegram_user_id=aid,
                    account_size=default,
                    balance=default,
                    day_start_balance=default,
                    stage=1,
                    trading_days=0,
                )
            )
        else:
            ch.account_size = default
            ch.balance = default
            ch.day_start_balance = default
            ch.stage = 1
            ch.trading_days = 0
