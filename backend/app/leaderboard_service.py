from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Signal, Trader
from app.schemas import TraderDayStat, TraderRead
from app.serializers import trader_to_read
from app.signal_service import get_or_create_trader, sync_admin_avatars
from app.trader_stats import pnl_usd_for_outcome, signal_trade_return_pct
from app.telegram_avatar import ensure_trader_avatar


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
        pnl = s.realized_pnl if s.realized_pnl is not None else pnl_usd_for_outcome(s, s.status)
        ret = signal_trade_return_pct(s, s.status)
        day = _day_key(s.closed_at)
        b = buckets[s.author_telegram_id][day]
        b["pnl"] = round(b["pnl"] + pnl, 2)
        b["rating"] = round(b["rating"] + ret, 2)
        if s.status == "win":
            b["w"] += 1
        else:
            b["l"] += 1

    out: dict[int, list[TraderDayStat]] = {}
    for tid, days in buckets.items():
        stats = [
            TraderDayStat(date=d, pnl_usd=v["pnl"], rating_delta=v["rating"], wins=v["w"], losses=v["l"])
            for d, v in sorted(days.items(), reverse=True)
        ]
        out[tid] = stats[:30]
    return out


def build_leaderboard(db: Session) -> list[TraderRead]:
    ids = sorted(settings.admin_id_set)
    if not ids:
        return []
    sync_admin_avatars(db)
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
        if not t.avatar_path:
            path = ensure_trader_avatar(t.telegram_id)
            if path:
                t.avatar_path = path
        total = (t.wins or 0) + (t.losses or 0)
        wr = round((t.wins or 0) / total * 100, 1) if total else 0.0
        result.append(trader_to_read(t, rank, wr, daily.get(t.telegram_id, [])))
    return result
