from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Trader
from app.rank_constants import (
    DEFAULT_RANK_ID,
    INITIAL_RANK_ID,
    RANK_BY_ID,
    better_rank,
    clamp_rank_id,
    get_rank_by_pct,
    rank_name,
    rank_one_step_better,
    rank_steps_worse,
)

logger = logging.getLogger(__name__)

MAX_RANK_HISTORY = 5


@dataclass
class RankHistoryEntry:
    week_label: str
    weekly_pct: float
    rank_id: int
    rank_name: str
    confirmed: bool

    def to_dict(self) -> dict:
        return {
            "week_label": self.week_label,
            "weekly_pct": self.weekly_pct,
            "rank_id": self.rank_id,
            "rank_name": self.rank_name,
            "confirmed": self.confirmed,
        }


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def current_week_label(now: datetime | None = None) -> str:
    n = now or _utc_now()
    iso = n.isocalendar()
    return f"Неделя {iso.week}"


def next_sunday_deadline(now: datetime | None = None) -> datetime:
    n = (now or _utc_now()).astimezone(timezone.utc)
    days_until_sunday = (6 - n.weekday()) % 7
    if days_until_sunday == 0 and n.hour >= 23 and n.minute >= 59:
        days_until_sunday = 7
    sunday = (n + timedelta(days=days_until_sunday)).replace(hour=23, minute=59, second=59, microsecond=0)
    return sunday


def _load_history(trader: Trader) -> list[dict]:
    raw = trader.rank_history_json
    if not raw:
        return []
    try:
        data = json.loads(raw)
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        return []


def _save_history(trader: Trader, entries: list[dict]) -> None:
    trader.rank_history_json = json.dumps(entries[:MAX_RANK_HISTORY], ensure_ascii=False)


def trader_closed_deals(trader: Trader) -> int:
    return (trader.wins or 0) + (trader.losses or 0)


def ensure_rank_fields(trader: Trader) -> None:
    if trader.current_rank_id is None:
        trader.current_rank_id = INITIAL_RANK_ID
    elif trader_closed_deals(trader) == 0 and trader.current_rank_id == DEFAULT_RANK_ID:
        trader.current_rank_id = INITIAL_RANK_ID
    if trader.weekly_pct is None:
        trader.weekly_pct = 0.0
    if trader.is_confirmed is None:
        trader.is_confirmed = True
    if trader.consecutive_loss_weeks is None:
        trader.consecutive_loss_weeks = 0
    if trader.shield_used_this_month is None:
        trader.shield_used_this_month = False
    if trader.shield_active is None:
        trader.shield_active = False
    if trader.rank_applied_this_week is None:
        trader.rank_applied_this_week = False
    if trader.confirm_deadline is None:
        trader.confirm_deadline = next_sunday_deadline()


def add_weekly_pct(trader: Trader, delta_pct: float) -> None:
    ensure_rank_fields(trader)
    trader.weekly_pct = round((trader.weekly_pct or 0.0) + delta_pct, 2)


def apply_first_close_rank(trader: Trader, move_pct: float) -> None:
    """Первая закрытая сделка: плюс — «В рынке», минус — «Нулёвый»."""
    ensure_rank_fields(trader)
    _apply_rank_change(trader, DEFAULT_RANK_ID if move_pct < 0 else INITIAL_RANK_ID)


def _apply_rank_change(trader: Trader, new_rank_id: int) -> None:
    trader.current_rank_id = clamp_rank_id(new_rank_id)


def apply_weekly_rank(trader: Trader, weekly_pct: float) -> int:
    """Пересчёт ранга по правилам недели. Возвращает новый rank_id."""
    ensure_rank_fields(trader)
    cur = trader.current_rank_id or DEFAULT_RANK_ID
    new_rank = cur

    if weekly_pct < 0:
        penalty = 2 if (trader.consecutive_loss_weeks or 0) >= 1 else 1
        stepped = rank_steps_worse(cur, penalty)
        perf_id = get_rank_by_pct(weekly_pct)
        new_rank = perf_id if better_rank(stepped, perf_id) else stepped
    else:
        step_better = rank_one_step_better(cur)
        if step_better != cur:
            nxt = RANK_BY_ID[step_better]
            if nxt.min_pct <= weekly_pct < nxt.max_pct:
                new_rank = step_better
        perf_id = get_rank_by_pct(weekly_pct)
        if better_rank(perf_id, new_rank):
            new_rank = perf_id

    _apply_rank_change(trader, new_rank)

    if weekly_pct < 0:
        trader.consecutive_loss_weeks = (trader.consecutive_loss_weeks or 0) + 1
    else:
        trader.consecutive_loss_weeks = 0

    trader.rank_applied_this_week = True
    trader.is_confirmed = True
    return trader.current_rank_id or DEFAULT_RANK_ID


def append_week_history(trader: Trader) -> None:
    hist = _load_history(trader)
    entry = RankHistoryEntry(
        week_label=current_week_label(),
        weekly_pct=round(trader.weekly_pct or 0.0, 2),
        rank_id=trader.current_rank_id or DEFAULT_RANK_ID,
        rank_name=rank_name(trader.current_rank_id or DEFAULT_RANK_ID),
        confirmed=True,
    )
    hist.insert(0, entry.to_dict())
    _save_history(trader, hist)


def reset_week_state(trader: Trader) -> None:
    trader.weekly_pct = 0.0
    trader.is_confirmed = True
    trader.rank_applied_this_week = False
    trader.confirm_deadline = next_sunday_deadline()


def process_monday_rollover(db: Session) -> int:
    """Понедельник 00:01 UTC: автоматический пересчёт ранга и увольнение при 2 минусовых неделях."""
    from app.trader_roster_service import ensure_auto_fired_for_minus_weeks

    admin_ids = settings.all_admin_id_set
    if not admin_ids:
        return 0

    traders = db.scalars(select(Trader).where(Trader.telegram_id.in_(admin_ids))).all()
    processed = 0
    for t in traders:
        ensure_rank_fields(t)
        weekly = t.weekly_pct or 0.0
        if weekly != 0.0:
            apply_weekly_rank(t, weekly)
        append_week_history(t)
        ensure_auto_fired_for_minus_weeks(db, t)
        reset_week_state(t)
        processed += 1

    if processed:
        logger.info("rank_monday_rollover: %s traders", processed)
    return processed


def trader_rank_payload(trader: Trader, *, include_history: bool = True) -> dict:
    ensure_rank_fields(trader)
    rid = trader.current_rank_id or DEFAULT_RANK_ID
    weekly = trader.weekly_pct or 0.0
    return {
        "current_rank_id": rid,
        "current_rank_name": rank_name(rid),
        "weekly_pct": weekly,
        "is_confirmed": True,
        "confirm_deadline": trader.confirm_deadline,
        "consecutive_loss_weeks": trader.consecutive_loss_weeks or 0,
        "shield_used_this_month": False,
        "shield_active": False,
        "rank_applied_this_week": bool(trader.rank_applied_this_week),
        "pending_rank_penalty": weekly < 0,
        "rank_history": _load_history(trader) if include_history else [],
    }
