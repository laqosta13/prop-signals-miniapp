"""Ротация трейдеров между ТОП / кандидаты / уволенные (главный админ)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Trader, TraderRosterOverride
from app.volnovoi_account import is_volnovoi_account

ROSTER_TOP = "top"
ROSTER_CANDIDATE = "candidate"
ROSTER_FIRED = "fired"

VALID_SECTIONS = frozenset({ROSTER_TOP, ROSTER_CANDIDATE, ROSTER_FIRED})

FIRED_RESTORE_DAYS = 14


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def can_leave_fired(db: Session, telegram_id: int) -> bool:
    row = db.get(TraderRosterOverride, telegram_id)
    if row is None or row.section != ROSTER_FIRED:
        return True
    since = row.updated_at
    if since is None:
        return True
    if since.tzinfo is None:
        since = since.replace(tzinfo=timezone.utc)
    return _utc_now() >= since + timedelta(days=FIRED_RESTORE_DAYS)


def _assert_can_leave_fired(db: Session, telegram_id: int) -> None:
    if not can_leave_fired(db, telegram_id):
        raise ValueError("fired_cooldown")


def ensure_auto_fired_for_minus_weeks(db: Session, trader: Trader) -> None:
    """Две минусовые недели подряд → блок «Уволенные»."""
    from app.rank_service import ensure_rank_fields

    ensure_rank_fields(trader)
    if (trader.consecutive_loss_weeks or 0) < 2:
        return
    row = db.get(TraderRosterOverride, trader.telegram_id)
    if row is not None and row.section == ROSTER_FIRED:
        return
    set_roster_override(db, trader.telegram_id, ROSTER_FIRED)


def roster_overrides_map(db: Session) -> dict[int, str]:
    rows = db.scalars(select(TraderRosterOverride)).all()
    return {r.telegram_id: r.section for r in rows}


def set_roster_override(db: Session, telegram_id: int, section: str) -> None:
    if is_volnovoi_account(telegram_id):
        raise ValueError("volnovoi_locked")
    if section not in VALID_SECTIONS:
        raise ValueError("invalid_section")
    row = db.get(TraderRosterOverride, telegram_id)
    if section in (ROSTER_TOP, ROSTER_CANDIDATE) and row is not None and row.section == ROSTER_FIRED:
        _assert_can_leave_fired(db, telegram_id)
    if row is None:
        db.add(TraderRosterOverride(telegram_id=telegram_id, section=section))
    else:
        row.section = section
    if section == ROSTER_FIRED:
        from app.challenge_service import delete_trader_tracker

        delete_trader_tracker(db, telegram_id)


def clear_roster_override(db: Session, telegram_id: int) -> bool:
    if is_volnovoi_account(telegram_id):
        raise ValueError("volnovoi_locked")
    row = db.get(TraderRosterOverride, telegram_id)
    if row is None:
        return False
    if row.section == ROSTER_FIRED:
        _assert_can_leave_fired(db, telegram_id)
    db.delete(row)
    return True


def top_trader_ids(db: Session, *, fired: set[int]) -> list[int]:
    """ID трейдеров в блоке «ТРЕЙДЕРЫ CULT» (без volnovoi)."""
    overrides = roster_overrides_map(db)

    ids: set[int] = set()
    for aid in settings.all_admin_id_set:
        if aid in fired:
            continue
        if overrides.get(aid) == ROSTER_CANDIDATE:
            continue
        ids.add(aid)

    for tid, sec in overrides.items():
        if sec == ROSTER_TOP and tid not in fired and tid not in settings.all_admin_id_set:
            ids.add(tid)

    return sorted(ids)


def demoted_admin_ids(db: Session) -> list[int]:
    overrides = roster_overrides_map(db)
    return sorted(
        tid
        for tid, sec in overrides.items()
        if sec == ROSTER_CANDIDATE and tid in settings.all_admin_id_set
    )


def is_roster_demoted_admin(db: Session, telegram_id: int) -> bool:
    return telegram_id in demoted_admin_ids(db)


def main_feed_publisher_ids(db: Session) -> set[int]:
    """Кто публикует в основную ленту (POST /signals)."""
    from app.leaderboard_service import fired_trader_ids

    overrides = roster_overrides_map(db)
    fired = set(fired_trader_ids(db))
    ids: set[int] = set()
    for aid in settings.all_admin_id_set:
        if aid in fired:
            continue
        if overrides.get(aid) == ROSTER_CANDIDATE:
            continue
        ids.add(aid)
    for tid, sec in overrides.items():
        if sec == ROSTER_TOP and tid not in fired:
            ids.add(tid)
    return ids


def is_main_feed_publisher(db: Session, telegram_id: int) -> bool:
    return telegram_id in main_feed_publisher_ids(db)


def can_publish_candidate_signals(db: Session, telegram_id: int) -> bool:
    """Кто публикует по правилам кандидатов (POST /cult-candidates/me/signals)."""
    from app.cult_candidate_service import is_cult_candidate, join_blockers
    from app.leaderboard_service import fired_trader_ids
    from app.models import Subscriber

    if telegram_id in fired_trader_ids(db):
        return False
    if is_main_feed_publisher(db, telegram_id):
        return False
    # Демотированный админ может публиковать без записи в cult_candidates
    if is_roster_demoted_admin(db, telegram_id):
        sub = db.get(Subscriber, telegram_id)
        if sub is None:
            return False
        bypass = cult_subscription_admin_bypass(db, telegram_id)
        return len(join_blockers(db, sub, cult_admin_bypass=bypass)) == 0
    if not is_cult_candidate(db, telegram_id):
        return False
    sub = db.get(Subscriber, telegram_id)
    if sub is None:
        return False
    bypass = cult_subscription_admin_bypass(db, telegram_id)
    return len(join_blockers(db, sub, cult_admin_bypass=bypass)) == 0


def cult_subscription_admin_bypass(db: Session, telegram_id: int) -> bool:
    """Бесплатная cult-подписка — все админы, включая переведённых в кандидаты."""
    _ = db
    return settings.is_signal_admin_id(telegram_id)
