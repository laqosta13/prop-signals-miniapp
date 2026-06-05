"""Ротация трейдеров между ТОП / кандидаты / уволенные (главный админ)."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import TraderRosterOverride
from app.volnovoi_account import is_volnovoi_account

ROSTER_TOP = "top"
ROSTER_CANDIDATE = "candidate"
ROSTER_FIRED = "fired"

VALID_SECTIONS = frozenset({ROSTER_TOP, ROSTER_CANDIDATE, ROSTER_FIRED})


def roster_overrides_map(db: Session) -> dict[int, str]:
    rows = db.scalars(select(TraderRosterOverride)).all()
    return {r.telegram_id: r.section for r in rows}


def set_roster_override(db: Session, telegram_id: int, section: str) -> None:
    if is_volnovoi_account(telegram_id):
        raise ValueError("volnovoi_locked")
    if section not in VALID_SECTIONS:
        raise ValueError("invalid_section")
    row = db.get(TraderRosterOverride, telegram_id)
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
    from app.cult_candidate_service import is_cult_candidate
    from app.leaderboard_service import fired_trader_ids

    if telegram_id in fired_trader_ids(db):
        return False
    if is_main_feed_publisher(db, telegram_id):
        return False
    if is_roster_demoted_admin(db, telegram_id):
        return is_cult_candidate(db, telegram_id)
    return is_cult_candidate(db, telegram_id)


def cult_subscription_admin_bypass(db: Session, telegram_id: int) -> bool:
    """Бесплатная cult-подписка — только админы в ТОП (не переведённые в кандидаты)."""
    return settings.is_signal_admin_id(telegram_id) and is_main_feed_publisher(db, telegram_id)
