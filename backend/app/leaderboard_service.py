from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Signal, Trader
from app.schemas import TraderDayStat, TraderRead
from app.serializers import trader_to_read
from app.signal_service import get_or_create_trader
from app.rank_service import ensure_rank_fields
from app.trader_roster_service import (
    ROSTER_CANDIDATE,
    ROSTER_FIRED,
    ROSTER_TOP,
    demoted_admin_ids,
    roster_overrides_map,
    top_trader_ids,
)
from app.trader_stats import closed_signal_move_pct, closed_signal_pnl_usd
from app.volnovoi_account import build_volnovoi_read


def _day_key(closed_at: datetime | None) -> str:
    if closed_at is None:
        return date.today().isoformat()
    if closed_at.tzinfo is None:
        closed_at = closed_at.replace(tzinfo=timezone.utc)
    return closed_at.astimezone(timezone.utc).date().isoformat()


def daily_stats_map(db: Session, admin_ids: list[int]) -> dict[int, list[TraderDayStat]]:
    if not admin_ids:
        return {}
    rows = db.scalars(
        select(Signal).where(
            Signal.author_telegram_id.in_(admin_ids),
            Signal.status.in_(("win", "lose")),
        )
    ).all()
    buckets: dict[int, dict[str, dict]] = defaultdict(lambda: defaultdict(lambda: {"pnl": 0.0, "rating": 0.0, "w": 0, "l": 0}))

    for s in rows:
        pnl = closed_signal_pnl_usd(s)
        ret = closed_signal_move_pct(s)
        day = _day_key(s.closed_at)
        b = buckets[s.author_telegram_id][day]
        b["pnl"] = round(b["pnl"] + pnl, 2)
        b["rating"] = round(b["rating"] + ret, 2)
        if pnl >= 0:
            b["w"] += 1
        else:
            b["l"] += 1

    out: dict[int, list[TraderDayStat]] = {}
    for tid, days in buckets.items():
        stats = [
            TraderDayStat(date=d, pnl_usd=v["pnl"], rating_delta=v["rating"], wins=v["w"], losses=v["l"])
            for d, v in sorted(days.items(), reverse=True)
        ]
        out[tid] = stats[:90]
    return out


def _trader_has_two_minus_weeks(trader: Trader) -> bool:
    """Две минусовые недели подряд: уже зафиксированы или идёт вторая (первая в consecutive_loss_weeks)."""
    ensure_rank_fields(trader)
    clw = trader.consecutive_loss_weeks or 0
    weekly = trader.weekly_pct or 0.0
    return clw >= 2 or (clw >= 1 and weekly < 0)


def fired_trader_ids(db: Session) -> list[int]:
    """Уволенные: env, две минусовые недели подряд, ручная ротация главного админа."""
    overrides = roster_overrides_map(db)
    active = settings.all_admin_id_set
    fired: set[int] = {
        tid for tid in settings.former_admin_id_set if tid not in active and tid != 0
    }
    if active:
        traders = db.scalars(select(Trader).where(Trader.telegram_id.in_(active))).all()
        for t in traders:
            if _trader_has_two_minus_weeks(t):
                fired.add(t.telegram_id)

    for tid, section in overrides.items():
        if section == ROSTER_FIRED:
            fired.add(tid)
        elif section in (ROSTER_TOP, ROSTER_CANDIDATE):
            fired.discard(tid)

    return sorted(fired)


def _traders_leaderboard_rows(db: Session, ids: list[int]) -> list[TraderRead]:
    if not ids:
        return []
    daily = daily_stats_map(db, ids)
    traders = {t.telegram_id: t for t in db.scalars(select(Trader).where(Trader.telegram_id.in_(ids)))}
    for aid in ids:
        if aid not in traders:
            traders[aid] = get_or_create_trader(db, aid, None)

    ranked = sorted(
        traders.values(),
        key=lambda t: (-(t.rating_percent or 0), -(t.wins or 0)),
    )
    result: list[TraderRead] = []
    for rank, t in enumerate(ranked, start=1):
        ensure_rank_fields(t)
        total = (t.wins or 0) + (t.losses or 0)
        wr = round((t.wins or 0) / total * 100, 1) if total else 0.0
        result.append(trader_to_read(t, rank, wr, daily.get(t.telegram_id, []), db=db))
    return result


def build_leaderboard(db: Session) -> list[TraderRead]:
    fired = set(fired_trader_ids(db))
    ids = top_trader_ids(db, fired=fired)
    result: list[TraderRead] = []
    volnovoi = build_volnovoi_read(db)
    if volnovoi is not None:
        result.append(volnovoi)
    if ids:
        result.extend(_traders_leaderboard_rows(db, ids))
    return result


def build_roster_demoted_admins(db: Session) -> list[TraderRead]:
    """Админы, переведённые главным админом в блок кандидатов."""
    ids = demoted_admin_ids(db)
    if not ids:
        return []
    return _traders_leaderboard_rows(db, ids)


def build_fired_leaderboard(db: Session) -> list[TraderRead]:
    rows = _traders_leaderboard_rows(db, fired_trader_ids(db))
    rows.sort(
        key=lambda r: (
            r.trader_rank.weekly_pct if r.trader_rank else 0.0,
            r.rating_percent,
        ),
    )
    return rows
