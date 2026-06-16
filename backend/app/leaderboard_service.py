from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Signal, Trader
from app.pool_service import calculate_trader_pool_shares, get_pool_balance
from app.schemas import TraderDayStat, TraderRead
from app.serializers import trader_to_read
from app.signal_service import get_or_create_trader
from app.rank_service import ensure_rank_fields
from app.trader_roster_service import (
    ROSTER_FIRED,
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
            Signal.is_cult_candidate.is_(False),
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


def fired_trader_ids(db: Session) -> list[int]:
    """Уволенные: бывшие админы из env и запись в trader_roster_overrides (в т.ч. авто после 2 минус. недель)."""
    overrides = roster_overrides_map(db)
    active = settings.all_admin_id_set
    fired: set[int] = {
        tid for tid in settings.former_admin_id_set if tid not in active and tid != 0
    }
    for tid, section in overrides.items():
        if section == ROSTER_FIRED:
            fired.add(tid)
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
    reads: list[TraderRead] = []
    for rank, t in enumerate(ranked, start=1):
        ensure_rank_fields(t)
        total = (t.wins or 0) + (t.losses or 0)
        wr = round((t.wins or 0) / total * 100, 1) if total else 0.0
        reads.append(trader_to_read(t, rank, wr, daily.get(t.telegram_id, []), db=db))

    pool_balance = get_pool_balance(db)
    shares = calculate_trader_pool_shares(reads, pool_balance)
    return [
        r.model_copy(update={"pool_share_usd": shares.get(r.telegram_id, 0.0)})
        for r in reads
    ]


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
    from app.pool_service import combined_candidate_pool_shares
    candidate_shares = combined_candidate_pool_shares(db)
    rows = _traders_leaderboard_rows(db, ids)
    # Заменяем долю трейдерского пула на долю кандидатского (10%)
    return [
        r.model_copy(update={"pool_share_usd": candidate_shares.get(r.telegram_id, 0.0)})
        for r in rows
    ]


def build_fired_leaderboard(db: Session) -> list[TraderRead]:
    rows = _traders_leaderboard_rows(db, fired_trader_ids(db))
    rows.sort(
        key=lambda r: (
            r.trader_rank.weekly_pct if r.trader_rank else 0.0,
            r.rating_percent,
        ),
    )
    return rows
