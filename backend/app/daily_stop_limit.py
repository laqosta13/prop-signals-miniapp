"""Дневные лимиты формы сигнала: риск до стопа и число сделок."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.hashhedge_rules import rules_for_stage
from app.models import Signal
from app.signal_utils import compute_signal_points_percent
from app.trader_stats import closed_signal_move_pct, signal_leverage
from app.tracker_metrics import compute_tracker_stats, msk_day_key

SIGNAL_DAILY_STOP_LIMIT_PCT = 2.0
SIGNAL_DAILY_TRADE_LIMIT = 3
ACCOUNT_STOP_MIN_STEP = 0.01
# Полный день при 1×: 2% цены = 2% шкалы «СТОП ЛИМИТ» (как бегунок «До стопа»).
DEFAULT_PRICE_STOP_FROM_ENTRY_PCT = 2.0
# Номинал ранга для дневного лимита 2% (как в форме — не от плеча в черновике).
RANK_NOMINAL_LEVERAGE_FOR_DAILY = 5


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
    from app.challenge_service import _tracker_closed_signals, get_challenge

    ch = get_challenge(db, admin_id)
    if ch is None:
        raise ValueError("tracker_not_configured")
    closed = _tracker_closed_signals(db, admin_id)
    rules = rules_for_stage(ch.stage)
    stats = compute_tracker_stats(
        ch,
        closed,
        max_daily_loss_pct=rules.max_daily_loss_pct,
    )
    return ch, stats


def admin_daily_loss_usd(db: Session, admin_id: int) -> float:
    """Фактический убыток за день (трекер Hash Hedge), не лимит формы сигнала."""
    _, stats = _admin_tracker_stats(db, admin_id)
    return stats.daily_loss_usd


def admin_daily_loss_pct(db: Session, admin_id: int) -> float:
    _, stats = _admin_tracker_stats(db, admin_id)
    return stats.daily_loss_pct


def market_close_consumed_rank_pct(
    signal: Signal,
    balance: float = 0.0,
    rank_max_stake_pct: float = 0.0,
) -> float:
    """Дневной лимит 2%: фактический % движения цены × плечо."""
    move = closed_signal_move_pct(signal)
    if move >= 0:
        return 0.0
    return price_stop_to_reserved_rank_pct(abs(move), signal_leverage(signal))


def signal_closed_stop_budget_rank_pct(
    signal: Signal,
    balance: float,
    rank_max_stake_pct: float,
) -> float:
    """
    Сколько % дневного лимита (0–2) уже «съел» закрытый сегодня сигнал.
    Любой убыточный исход — фактический PnL / номинал ранга × 100.
    Цель и прибыльное закрытие — 0.
    """
    if signal.status not in ("win", "lose"):
        return 0.0
    if signal.close_reason == "target" or signal.status != "lose":
        return 0.0
    return market_close_consumed_rank_pct(signal, balance, rank_max_stake_pct)


def admin_stop_consumed_rank_pct(
    db: Session,
    admin_id: int,
    balance: float,
    rank_max_stake_pct: float,
) -> float:
    """Сумма % номинала ранга по стопам, сработавшим сегодня (MSK)."""
    today_key = msk_day_key(datetime.now(timezone.utc))
    if not today_key:
        return 0.0
    total = 0.0
    rows = db.scalars(
        select(Signal).where(
            Signal.author_telegram_id == admin_id,
            Signal.status.in_(("win", "lose")),
            Signal.is_cult_candidate.is_(False),
        )
    ).all()
    for sig in rows:
        if msk_day_key(sig.closed_at) != today_key:
            continue
        total += signal_closed_stop_budget_rank_pct(sig, balance, rank_max_stake_pct)
    return round(min(total, SIGNAL_DAILY_STOP_LIMIT_PCT), 2)


def daily_stop_remaining_rank_pct(
    consumed_rank_pct: float,
    *,
    reserved_rank_pct: float = 0.0,
) -> float:
    """Остаток дневного лимита 2% в единицах «% от номинала ранга»."""
    return round(
        max(
            0.0,
            SIGNAL_DAILY_STOP_LIMIT_PCT
            - max(0.0, consumed_rank_pct)
            - max(0.0, reserved_rank_pct),
        ),
        2,
    )


def _admin_active_signals(db: Session, admin_id: int) -> list[Signal]:
    return list(
        db.scalars(
            select(Signal).where(
                Signal.author_telegram_id == admin_id,
                Signal.status == "active",
                Signal.is_cult_candidate.is_(False),
            )
        ).all()
    )


def price_stop_to_reserved_rank_pct(price_stop_pct: float, leverage: int = 1) -> float:
    """
    Доля дневного лимита 2%: % цены до стопа × плечо (2×…5× — пропорционально).
    Фолбэк когда нет данных о размере позиции — предполагает максимальный стейк.
    1×: 2% цены → 2%; 2×: 1% → 2%; 3×: 0.67% → 2%; 4×: 0.5% → 2%; 5×: 0.4% → 2%.
    """
    lev = max(1, int(leverage or 1))
    if price_stop_pct <= 0:
        return 0.0
    effective_pct = price_stop_pct * lev
    return round(
        min(
            effective_pct
            * SIGNAL_DAILY_STOP_LIMIT_PCT
            / DEFAULT_PRICE_STOP_FROM_ENTRY_PCT,
            SIGNAL_DAILY_STOP_LIMIT_PCT,
        ),
        2,
    )


def _stake_aware_rank_pct(
    price_pct: float,
    leverage: int,
    stake_pct: float,
    rank_max_stake_pct: float,
) -> float:
    """
    Корректная доля дневного лимита с учётом фактического размера позиции.
    consumed = stake / rank_max × lev / REF_LEV × price_stop / REF_STOP × LIMIT
    При stake=rank_max, lev=REF_LEV=5×, price_stop=REF_STOP=2% → consumed=2% (полный бюджет).
    """
    if price_pct <= 0 or stake_pct <= 0 or rank_max_stake_pct <= 0:
        return 0.0
    lev = max(1, int(leverage or 1))
    consumed = (
        stake_pct
        * lev
        * price_pct
        / (rank_max_stake_pct * RANK_NOMINAL_LEVERAGE_FOR_DAILY * DEFAULT_PRICE_STOP_FROM_ENTRY_PCT)
        * SIGNAL_DAILY_STOP_LIMIT_PCT
    )
    return round(min(consumed, SIGNAL_DAILY_STOP_LIMIT_PCT), 2)


def signal_price_stop_pct(signal: Signal) -> float:
    if not signal.stop_loss:
        return 0.0
    return compute_signal_points_percent(
        signal.entry_low,
        signal.entry_high,
        signal.stop_loss,
    )


def signal_reserved_rank_pct(
    signal: Signal,
    balance: float,
    rank_max_stake_pct: float,
) -> float:
    """Сколько % дневного лимита (0–2) «заморожено» стопом сигнала с учётом плеча и размера позиции."""
    lev = int(signal.leverage or 1)
    price_stop = signal_price_stop_pct(signal)
    stake = float(signal.risk_percent or 0)
    if stake > 0 and balance > 0 and rank_max_stake_pct > 0:
        return _stake_aware_rank_pct(price_stop, lev, stake, rank_max_stake_pct)
    return price_stop_to_reserved_rank_pct(price_stop, lev)


def admin_active_stop_reserved_rank_pct(
    db: Session,
    admin_id: int,
    balance: float,
    rank_max_stake_pct: float,
    *,
    exclude_signal_id: int | None = None,
) -> float:
    """Сумма заморозки по всем активным сигналам (пока стоп не отработал — лимит занят)."""
    total = 0.0
    for sig in _admin_active_signals(db, admin_id):
        if exclude_signal_id is not None and sig.id == exclude_signal_id:
            continue
        total += price_stop_to_reserved_rank_pct(signal_price_stop_pct(sig), int(sig.leverage or 1))
    return round(min(total, SIGNAL_DAILY_STOP_LIMIT_PCT), 2)


def admin_daily_stop_form_state(
    db: Session,
    admin_id: int,
    balance: float,
    rank_max_stake_pct: float,
    *,
    exclude_signal_id: int | None = None,
) -> dict[str, float]:
    rank_nominal_ref = rank_nominal_usd(balance, rank_max_stake_pct, RANK_NOMINAL_LEVERAGE_FOR_DAILY)
    consumed_rank_pct = admin_stop_consumed_rank_pct(db, admin_id, balance, rank_max_stake_pct)
    reserved_rank_pct = admin_active_stop_reserved_rank_pct(
        db,
        admin_id,
        balance,
        rank_max_stake_pct,
        exclude_signal_id=exclude_signal_id,
    )
    remaining_rank_pct = daily_stop_remaining_rank_pct(
        consumed_rank_pct,
        reserved_rank_pct=reserved_rank_pct,
    )
    consumed_usd = (
        round(consumed_rank_pct / 100.0 * rank_nominal_ref, 2) if rank_nominal_ref > 0 else 0.0
    )
    remaining_usd = (
        round(remaining_rank_pct / 100.0 * rank_nominal_ref, 2) if rank_nominal_ref > 0 else 0.0
    )
    return {
        "rank_nominal_usd": rank_nominal_ref,
        "consumed_rank_pct": consumed_rank_pct,
        "consumed_usd": consumed_usd,
        "reserved_rank_pct": reserved_rank_pct,
        "remaining_rank_pct": remaining_rank_pct,
        "remaining_usd": remaining_usd,
    }


def daily_stop_remaining_usd(daily_loss_usd: float, rank_nominal_usd: float) -> float:
    return round(max(0.0, daily_stop_budget_usd(rank_nominal_usd) - daily_loss_usd), 2)


def daily_stop_remaining_pct(daily_loss_pct: float) -> float:
    """Устаревшая база (% счёта); для формы используйте daily_stop_remaining_rank_pct."""
    return round(max(0.0, SIGNAL_DAILY_STOP_LIMIT_PCT - max(0.0, daily_loss_pct)), 2)


def admin_signals_today_count(db: Session, admin_id: int) -> int:
    today_key = msk_day_key(datetime.now(timezone.utc))
    if not today_key:
        return 0
    rows = db.scalars(
        select(Signal).where(
            Signal.author_telegram_id == admin_id,
            Signal.is_cult_candidate.is_(False),
        )
    ).all()
    return sum(1 for s in rows if msk_day_key(s.created_at) == today_key)


def validate_signal_daily_stop(
    db: Session,
    admin_id: int,
    entry_low: str | None,
    entry_high: str | None,
    stop_loss: str | None,
    stake_pct: float,
    leverage: int,
    *,
    exclude_signal_id: int | None = None,
) -> None:
    from app.challenge_service import signal_form_reference_balance
    from app.signal_service import get_or_create_trader
    from app.signal_stake_pool import stake_pool_snapshot

    trader = get_or_create_trader(db, admin_id, None)
    snap = stake_pool_snapshot(
        db,
        trader,
        author_telegram_id=admin_id,
        exclude_signal_id=exclude_signal_id,
    )
    rank_cap = float(snap["rank_max_stake_pct"])

    balance = signal_form_reference_balance(db, admin_id)
    stop_state = admin_daily_stop_form_state(
        db,
        admin_id,
        balance,
        rank_cap,
        exclude_signal_id=exclude_signal_id,
    )
    rank_nominal = stop_state["rank_nominal_usd"]
    consumed_pct = stop_state["consumed_rank_pct"]
    remaining_pct = stop_state["remaining_rank_pct"]
    reserved_pct = stop_state["reserved_rank_pct"]

    if remaining_pct < ACCOUNT_STOP_MIN_STEP:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Стоп-лимит {SIGNAL_DAILY_STOP_LIMIT_PCT:g}% дня исчерпан "
                f"(использовано {consumed_pct:g}%, заморожено {reserved_pct:g}%, "
                f"лимит ${daily_stop_budget_usd(rank_nominal):g})"
            ),
        )

    if not stop_loss:
        return

    price_stop_pct = compute_signal_points_percent(entry_low, entry_high, stop_loss)
    needed_rank_pct = price_stop_to_reserved_rank_pct(price_stop_pct, leverage)
    if needed_rank_pct > remaining_pct + 0.01:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Стоп {price_stop_pct:g}% цены занимает {needed_rank_pct:g}% дневного лимита "
                f"({SIGNAL_DAILY_STOP_LIMIT_PCT:g}% макс.), остаток {remaining_pct:g}% "
                f"(использовано {consumed_pct:g}%, заморожено {reserved_pct:g}%)"
            ),
        )
