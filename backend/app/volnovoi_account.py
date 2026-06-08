"""Сводный аккаунт volnovoi — все закрытые сделки админов в одном портфеле."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Signal
from app.rank_constants import get_rank_by_pct, rank_name
from app.rank_service import next_sunday_deadline
from app.schemas import TraderDayStat, TraderRankRead, TraderRead
from app.trader_stats import (
    closed_signal_move_pct,
    signal_entry_stake_pct,
    signal_leverage,
)

VOLNOVOI_TELEGRAM_ID = 0
VOLNOVOI_DISPLAY_NAME = "volnovoi"
VOLNOVOI_USERNAME = "volnovoi"
VOLNOVOI_CAPITAL_USD = 100_000.0
VOLNOVOI_AVATAR_URL = "/avatars/volnovoi.png"


def is_volnovoi_account(telegram_id: int) -> bool:
    return telegram_id == VOLNOVOI_TELEGRAM_ID


def volnovoi_signal_pnl_usd(signal: Signal) -> float:
    """P/L сделки на капитале volnovoi: те же вход % и плечо, база $100k."""
    move = closed_signal_move_pct(signal)
    stake = signal_entry_stake_pct(signal)
    lev = signal_leverage(signal)
    nominal = VOLNOVOI_CAPITAL_USD * stake / 100.0 * lev
    return round(nominal * move / 100.0, 2)


def volnovoi_signal_return_pct(signal: Signal) -> float:
    """Доходность сделки в % от капитала volnovoi."""
    return round(volnovoi_signal_pnl_usd(signal) / VOLNOVOI_CAPITAL_USD * 100.0, 2)


def _day_key(closed_at: datetime | None) -> str:
    if closed_at is None:
        return datetime.now(timezone.utc).date().isoformat()
    if closed_at.tzinfo is None:
        closed_at = closed_at.replace(tzinfo=timezone.utc)
    return closed_at.astimezone(timezone.utc).date().isoformat()


def _in_current_iso_week(closed_at: datetime | None, now: datetime) -> bool:
    if closed_at is None:
        return False
    if closed_at.tzinfo is None:
        closed_at = closed_at.replace(tzinfo=timezone.utc)
    return closed_at.astimezone(timezone.utc).isocalendar()[:2] == now.isocalendar()[:2]


def _closed_admin_signals(db: Session, admin_ids: list[int]) -> list[Signal]:
    if not admin_ids:
        return []
    return list(
        db.scalars(
            select(Signal).where(
                Signal.author_telegram_id.in_(admin_ids),
                Signal.status.in_(("win", "lose")),
            )
        ).all()
    )


def volnovoi_daily_stats(signals: list[Signal]) -> list[TraderDayStat]:
    buckets: dict[str, dict] = defaultdict(lambda: {"pnl": 0.0, "rating": 0.0, "w": 0, "l": 0})
    for s in signals:
        pnl = volnovoi_signal_pnl_usd(s)
        ret = volnovoi_signal_return_pct(s)
        day = _day_key(s.closed_at)
        b = buckets[day]
        b["pnl"] = round(b["pnl"] + pnl, 2)
        b["rating"] = round(b["rating"] + ret, 2)
        if pnl >= 0:
            b["w"] += 1
        else:
            b["l"] += 1
    return [
        TraderDayStat(date=d, pnl_usd=v["pnl"], rating_delta=v["rating"], wins=v["w"], losses=v["l"])
        for d, v in sorted(buckets.items(), reverse=True)
    ][:90]


def volnovoi_rank_read(weekly_pct: float, rating_pct: float) -> TraderRankRead:
    """Ранг volnovoi онлайн по суммарному % портфеля (каждая закрытая сделка)."""
    rank_id = get_rank_by_pct(rating_pct)
    return TraderRankRead(
        current_rank_id=rank_id,
        current_rank_name=rank_name(rank_id),
        weekly_pct=round(weekly_pct, 2),
        is_confirmed=True,
        confirm_deadline=next_sunday_deadline(),
        consecutive_loss_weeks=0,
        shield_used_this_month=False,
        shield_active=False,
        rank_applied_this_week=False,
        pending_rank_penalty=rating_pct < 0,
        rank_history=[],
    )


def build_volnovoi_read(db: Session) -> TraderRead | None:
    admin_ids = sorted(settings.all_admin_id_set)
    if not admin_ids:
        return None

    signals = _closed_admin_signals(db, admin_ids)
    if not signals:
        return None

    now = datetime.now(timezone.utc)
    rating = 0.0
    pnl_total = 0.0
    weekly = 0.0
    wins = 0
    losses = 0

    for s in signals:
        ret = volnovoi_signal_return_pct(s)
        pnl = volnovoi_signal_pnl_usd(s)
        rating = round(rating + ret, 2)
        pnl_total = round(pnl_total + pnl, 2)
        if _in_current_iso_week(s.closed_at, now):
            weekly = round(weekly + ret, 2)
        if pnl >= 0:
            wins += 1
        else:
            losses += 1

    total = wins + losses
    wr = round(wins / total * 100, 1) if total else 0.0

    return TraderRead(
        telegram_id=VOLNOVOI_TELEGRAM_ID,
        username=VOLNOVOI_USERNAME,
        display_name=VOLNOVOI_DISPLAY_NAME,
        rating_percent=rating,
        total_pnl_usd=pnl_total,
        wins=wins,
        losses=losses,
        rank=0,
        win_rate=wr,
        avatar_url=VOLNOVOI_AVATAR_URL,
        daily_stats=volnovoi_daily_stats(signals),
        trader_rank=volnovoi_rank_read(weekly, rating) if total else None,
        is_aggregate=True,
    )
