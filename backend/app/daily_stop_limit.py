"""Дневные лимиты формы сигнала: риск до стопа и число сделок."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.challenge_service import _closed_signals, get_or_create_challenge
from app.hashhedge_rules import rules_for_stage
from app.models import Signal
from app.signal_utils import compute_signal_points_percent
from app.tracker_metrics import compute_tracker_stats, msk_day_key

SIGNAL_DAILY_STOP_LIMIT_PCT = 2.0
SIGNAL_DAILY_TRADE_LIMIT = 3
ACCOUNT_STOP_MIN_STEP = 0.01


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


def admin_daily_loss_pct(db: Session, admin_id: int) -> float:
    ch = get_or_create_challenge(db, admin_id)
    closed = _closed_signals(db, admin_id)
    rules = rules_for_stage(ch.stage)
    stats = compute_tracker_stats(
        ch,
        closed,
        max_daily_loss_pct=rules.max_daily_loss_pct,
    )
    return stats.daily_loss_pct


def daily_stop_remaining_pct(daily_loss_pct: float) -> float:
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
                f"{SIGNAL_DAILY_STOP_LIMIT_PCT}% стопа — сделок сегодня уже {count}"
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
    daily_loss = admin_daily_loss_pct(db, admin_id)
    remaining = daily_stop_remaining_pct(daily_loss)
    if remaining < ACCOUNT_STOP_MIN_STEP:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Лимит дня: {SIGNAL_DAILY_TRADE_LIMIT} сделки или "
                f"{SIGNAL_DAILY_STOP_LIMIT_PCT}% стопа — дневной стоп исчерпан "
                f"(потери {daily_loss}%)"
            ),
        )
    account_risk = account_risk_at_stop(entry_low, entry_high, stop_loss, stake_pct, leverage)
    if account_risk is None:
        return
    if account_risk > remaining + 0.005:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Риск до стопа {account_risk}% превышает остаток {remaining}% "
                f"(лимит {SIGNAL_DAILY_STOP_LIMIT_PCT}% стопа, потери {daily_loss}%)"
            ),
        )
