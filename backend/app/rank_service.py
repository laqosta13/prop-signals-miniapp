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
    # Monday=0 … Sunday=6
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


def ensure_rank_fields(trader: Trader) -> None:
    if trader.current_rank_id is None:
        trader.current_rank_id = DEFAULT_RANK_ID
    if trader.weekly_pct is None:
        trader.weekly_pct = 0.0
    if trader.is_confirmed is None:
        trader.is_confirmed = False
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


def _apply_rank_change(trader: Trader, new_rank_id: int) -> None:
    trader.current_rank_id = clamp_rank_id(new_rank_id)


def apply_penalty(trader: Trader, steps: int = 1) -> None:
    ensure_rank_fields(trader)
    cur = trader.current_rank_id or DEFAULT_RANK_ID
    _apply_rank_change(trader, cur + steps)


def apply_weekly_rank(trader: Trader, weekly_pct: float) -> int:
    """Пересчёт ранга по правилам недели. Возвращает новый rank_id."""
    ensure_rank_fields(trader)
    cur = trader.current_rank_id or DEFAULT_RANK_ID
    new_rank = cur
    shield_skip = bool(trader.shield_active)

    if weekly_pct < 0 and not shield_skip:
        penalty = 2 if (trader.consecutive_loss_weeks or 0) >= 1 else 1
        new_rank = rank_steps_worse(cur, penalty)
    elif weekly_pct < 0 and shield_skip:
        trader.shield_active = False
        new_rank = cur
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
    return trader.current_rank_id or DEFAULT_RANK_ID


def append_week_history(trader: Trader, *, confirmed: bool) -> None:
    hist = _load_history(trader)
    entry = RankHistoryEntry(
        week_label=current_week_label(),
        weekly_pct=round(trader.weekly_pct or 0.0, 2),
        rank_id=trader.current_rank_id or DEFAULT_RANK_ID,
        rank_name=rank_name(trader.current_rank_id or DEFAULT_RANK_ID),
        confirmed=confirmed,
    )
    hist.insert(0, entry.to_dict())
    _save_history(trader, hist)


def reset_week_state(trader: Trader) -> None:
    trader.weekly_pct = 0.0
    trader.is_confirmed = False
    trader.rank_applied_this_week = False
    trader.confirm_deadline = next_sunday_deadline()


def confirm_rank(trader: Trader) -> None:
    ensure_rank_fields(trader)
    if trader.rank_applied_this_week:
        trader.is_confirmed = True
        return
    apply_weekly_rank(trader, trader.weekly_pct or 0.0)
    trader.is_confirmed = True


def activate_shield(trader: Trader) -> None:
    ensure_rank_fields(trader)
    if trader.shield_used_this_month:
        raise ValueError("shield_already_used")
    trader.shield_active = True
    trader.shield_used_this_month = True


def process_monday_rollover(db: Session) -> int:
    """Понедельник 00:01 UTC: штраф за неподтверждение, иначе apply, сброс недели."""
    admin_ids = settings.admin_id_set
    if not admin_ids:
        return 0
    now = _utc_now()
    reset_shields = now.day <= 7

    traders = db.scalars(select(Trader).where(Trader.telegram_id.in_(admin_ids))).all()
    processed = 0
    for t in traders:
        ensure_rank_fields(t)
        if reset_shields:
            t.shield_used_this_month = False
            t.shield_active = False

        weekly = t.weekly_pct or 0.0
        if not t.is_confirmed:
            apply_penalty(t, 1)
            append_week_history(t, confirmed=False)
        elif not t.rank_applied_this_week:
            apply_weekly_rank(t, weekly)
            append_week_history(t, confirmed=True)
        else:
            append_week_history(t, confirmed=True)

        reset_week_state(t)
        processed += 1

    if processed:
        logger.info("rank_monday_rollover: %s traders", processed)
    return processed


def trader_rank_payload(trader: Trader, *, include_history: bool = True) -> dict:
    ensure_rank_fields(trader)
    rid = trader.current_rank_id or DEFAULT_RANK_ID
    weekly = trader.weekly_pct or 0.0
    pending_penalty = weekly < 0 and not trader.shield_active
    return {
        "current_rank_id": rid,
        "current_rank_name": rank_name(rid),
        "weekly_pct": weekly,
        "is_confirmed": bool(trader.is_confirmed),
        "confirm_deadline": trader.confirm_deadline,
        "consecutive_loss_weeks": trader.consecutive_loss_weeks or 0,
        "shield_used_this_month": bool(trader.shield_used_this_month),
        "shield_active": bool(trader.shield_active),
        "rank_applied_this_week": bool(trader.rank_applied_this_week),
        "pending_rank_penalty": pending_penalty,
        "rank_history": _load_history(trader) if include_history else [],
    }


def needs_confirm_prompt(trader: Trader) -> bool:
    ensure_rank_fields(trader)
    if trader.is_confirmed or trader.rank_applied_this_week:
        return False
    deadline = trader.confirm_deadline
    if deadline and _utc_now() > deadline.astimezone(timezone.utc):
        return False
    return True
