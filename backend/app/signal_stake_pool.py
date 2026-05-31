"""Общий пул суммы входа % для копирующих volnovoi: активные сигналы админов ≤ 100%."""

from __future__ import annotations

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Signal, Trader
from app.rank_constants import DEFAULT_RANK_ID, RANK_MAX_STAKE_PCT
from app.rank_service import ensure_rank_fields
from app.trader_stats import DEFAULT_ENTRY_STAKE_PCT

STAKE_POOL_TOTAL_PCT = 100.0


def rank_max_stake_pct(rank_id: int | None) -> float:
    rid = rank_id if rank_id is not None else DEFAULT_RANK_ID
    return RANK_MAX_STAKE_PCT.get(rid, RANK_MAX_STAKE_PCT[DEFAULT_RANK_ID])


def _signal_stake_expr():
    return case(
        (Signal.risk_percent.isnot(None), func.coalesce(Signal.risk_percent, 0.0)),
        else_=DEFAULT_ENTRY_STAKE_PCT,
    )


def active_admin_stake_used(db: Session, *, exclude_signal_id: int | None = None) -> float:
    """Сумма входа % по активным сигналам всех админов культа."""
    admin_ids = tuple(settings.admin_id_set)
    if not admin_ids:
        return 0.0
    q = select(func.coalesce(func.sum(_signal_stake_expr()), 0.0)).where(
        Signal.status == "active",
        Signal.author_telegram_id.in_(admin_ids),
    )
    if exclude_signal_id is not None:
        q = q.where(Signal.id != exclude_signal_id)
    return round(float(db.scalar(q) or 0.0), 2)


def stake_pool_remaining(db: Session, *, exclude_signal_id: int | None = None) -> float:
    used = active_admin_stake_used(db, exclude_signal_id=exclude_signal_id)
    return round(max(0.0, STAKE_POOL_TOTAL_PCT - used), 2)


def effective_max_stake_pct(
    db: Session,
    trader: Trader,
    *,
    exclude_signal_id: int | None = None,
) -> float:
    ensure_rank_fields(trader)
    rank_cap = rank_max_stake_pct(trader.current_rank_id)
    pool_left = stake_pool_remaining(db, exclude_signal_id=exclude_signal_id)
    return round(min(rank_cap, pool_left), 2)


def stake_pool_snapshot(
    db: Session,
    trader: Trader,
    *,
    exclude_signal_id: int | None = None,
) -> dict[str, float | int | str]:
    ensure_rank_fields(trader)
    rank_id = trader.current_rank_id or DEFAULT_RANK_ID
    used = active_admin_stake_used(db, exclude_signal_id=exclude_signal_id)
    remaining = round(max(0.0, STAKE_POOL_TOTAL_PCT - used), 2)
    rank_cap = rank_max_stake_pct(rank_id)
    from app.rank_constants import rank_name

    return {
        "current_rank_id": rank_id,
        "current_rank_name": rank_name(rank_id),
        "rank_max_stake_pct": rank_cap,
        "stake_pool_used_pct": used,
        "stake_pool_remaining_pct": remaining,
        "max_stake_pct": round(min(rank_cap, remaining), 2),
    }


def validate_signal_stake_pool(
    db: Session,
    author_telegram_id: int,
    stake_pct: float,
    *,
    exclude_signal_id: int | None = None,
) -> None:
    from fastapi import HTTPException, status

    from app.signal_service import get_or_create_trader

    if stake_pct <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Сумма входа должна быть больше 0%",
        )

    trader = get_or_create_trader(db, author_telegram_id, None)
    snap = stake_pool_snapshot(db, trader, exclude_signal_id=exclude_signal_id)
    rank_cap = float(snap["rank_max_stake_pct"])
    pool_left = float(snap["stake_pool_remaining_pct"])
    max_allowed = float(snap["max_stake_pct"])

    if stake_pct > rank_cap + 0.001:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Максимум {rank_cap:g}% входа для ранга «{snap['current_rank_name']}»",
        )
    if stake_pct > pool_left + 0.001:
        used = float(snap["stake_pool_used_pct"])
        if pool_left <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="100% депозита копирующих уже задействовано другими активными сигналами",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Занято {used:g}% депозита копирующих — доступно {pool_left:g}%",
        )
    if stake_pct > max_allowed + 0.001:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Максимальная сумма входа сейчас {max_allowed:g}%",
        )
