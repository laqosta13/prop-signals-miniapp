"""Дневные лимиты формы сигнала: риск до стопа и число сделок."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.hashhedge_rules import rules_for_stage
from app.models import Signal
from app.signal_utils import compute_signal_points_percent
from app.tracker_metrics import compute_tracker_stats, msk_day_key

SIGNAL_DAILY_STOP_LIMIT_PCT = 2.0
SIGNAL_DAILY_TRADE_LIMIT = 3
ACCOUNT_STOP_MIN_STEP = 0.01


def rank_nominal_usd(balance: float, rank_max_stake_pct: float, leverage: int) -> float:
    """Макс. номинал позиции по рангу: счёт × лимит ранга % × плечо."""
    if balance <= 0 or rank_max_stake_pct <= 0 or leverage < 1:
        return 0.0
    return round(balance * rank_max_stake_pct * leverage / 100.0, 2)


def daily_stop_budget_usd(rank_nominal_usd: float) -> float:
    """Дневной бюджет стопа = 2% от номинала ранга ($)."""
    return round(rank_nominal_usd * SIGNAL_DAILY_STOP_LIMIT_PCT / 100.0, 2)


def price_stop_to_account_risk_pct(
    price_stop_pct: float,
    stake_pct: float,
    leverage: int,
) -> float:
    if price_stop_pct <= 0 or stake_pct <= 0 or leverage < 1:
        return 0.0
    return round(price_stop_pct * stake_pct * leverage / 100.0, 2)


def account_risk_at_stop(
    entry_low: str | None,
    entry_high: str | None,
    stop_loss: str | None,
    stake_pct: float,
    leverage: int,
) -> float | None:
    if not stop_loss:
        return None
    price_stop_pct = compute_signal_points_percent(entry_low, entry_high, stop_loss)
    return price_stop_to_account_risk_pct(price_stop_pct, stake_pct, leverage)


def _admin_tracker_stats(db: Session, admin_id: int):
    from app.challenge_service import _closed_signals, get_or_create_challenge

    ch = get_or_create_challenge(db, admin_id)
    closed = _closed_signals(db, admin_id)
    rules = rules_for_stage(ch.stage)
    stats = compute_tracker_stats(
        ch,
        closed,
        max_daily_loss_pct=rules.max_daily_loss_pct,
    )
    return ch, stats


def admin_daily_loss_usd(db: Session, admin_id: int) -> float:
    _, stats = _admin_tracker_stats(db, admin_id)
    return stats.daily_loss_usd


def admin_daily_loss_pct(db: Session, admin_id: int) -> float:
    _, stats = _admin_tracker_stats(db, admin_id)
    return stats.daily_loss_pct


def daily_stop_remaining_rank_pct(daily_loss_usd: float, rank_nominal_usd: float) -> float:
    """Остаток дневного лимита 2% в единицах «% от номинала ранга»."""
    if rank_nominal_usd <= 0:
        return 0.0
    used_pct = daily_loss_usd / rank_nominal_usd * 100.0
    return round(max(0.0, SIGNAL_DAILY_STOP_LIMIT_PCT - used_pct), 2)


def daily_stop_remaining_usd(daily_loss_usd: float, rank_nominal_usd: float) -> float:
    return round(max(0.0, daily_stop_budget_usd(rank_nominal_usd) - daily_loss_usd), 2)


def daily_stop_remaining_pct(daily_loss_pct: float) -> float:
    """Устаревшая база (% счёта); для формы используйте daily_stop_remaining_rank_pct."""
    return round(max(0.0, SIGNAL_DAILY_STOP_LIMIT_PCT - max(0.0, daily_loss_pct)), 2)


def admin_signals_today_count(db: Session, admin_id: int) -> int:
    today_key = msk_day_key(datetime.now(timezone.utc))
    if not today_key:
        return 0
    rows = db.scalars(select(Signal).where(Signal.author_telegram_id == admin_id)).all()
    return sum(1 for s in rows if msk_day_key(s.created_at) == today_key)


def daily_trades_remaining(count: int) -> int:
    return max(0, SIGNAL_DAILY_TRADE_LIMIT - max(0, count))


def validate_signal_daily_trades(db: Session, admin_id: int) -> None:
    count = admin_signals_today_count(db, admin_id)
    if count >= SIGNAL_DAILY_TRADE_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Лимит дня: {SIGNAL_DAILY_TRADE_LIMIT} сделки или "
                f"{SIGNAL_DAILY_STOP_LIMIT_PCT:g}% стопа от номинала ранга — сделок сегодня уже {count}"
            ),
        )


def validate_signal_daily_stop(
    db: Session,
    admin_id: int,
    entry_low: str | None,
    entry_high: str | None,
    stop_loss: str | None,
    stake_pct: float,
    leverage: int,
) -> None:
    from app.signal_service import get_or_create_trader
    from app.signal_stake_pool import stake_pool_snapshot

    trader = get_or_create_trader(db, admin_id, None)
    snap = stake_pool_snapshot(db, trader)
    rank_cap = float(snap["rank_max_stake_pct"])

    ch, _ = _admin_tracker_stats(db, admin_id)
    balance = ch.balance
    rank_nominal = rank_nominal_usd(balance, rank_cap, leverage)
    daily_loss_usd = admin_daily_loss_usd(db, admin_id)
    remaining_pct = daily_stop_remaining_rank_pct(daily_loss_usd, rank_nominal)

    if remaining_pct < ACCOUNT_STOP_MIN_STEP:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Лимит дня: {SIGNAL_DAILY_TRADE_LIMIT} сделки или "
                f"{SIGNAL_DAILY_STOP_LIMIT_PCT:g}% стопа от номинала ранга — дневной стоп исчерпан "
                f"(потери ${daily_loss_usd:g} при лимите ${daily_stop_budget_usd(rank_nominal):g})"
            ),
        )

    account_risk = account_risk_at_stop(entry_low, entry_high, stop_loss, stake_pct, leverage)
    if account_risk is None:
        return

    risk_usd = balance * account_risk / 100.0
    budget_left_usd = daily_stop_remaining_usd(daily_loss_usd, rank_nominal)
    if risk_usd > budget_left_usd + 0.01:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Риск до стопа ${risk_usd:g} превышает остаток ${budget_left_usd:g} "
                f"(лимит {SIGNAL_DAILY_STOP_LIMIT_PCT:g}% от номинала ранга ${rank_nominal:g}, "
                f"потери сегодня ${daily_loss_usd:g})"
            ),
        )
