"""Метрики трекера Hash Hedge из закрытых сигналов (день — Europe/Moscow)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from app.models import Signal, UserChallenge
from app.trader_stats import pnl_usd_for_outcome

MSK = ZoneInfo("Europe/Moscow")


def msk_day_key(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(MSK).strftime("%Y-%m-%d")


def signal_pnl_usd(signal: Signal) -> float:
    if signal.realized_pnl is not None:
        return float(signal.realized_pnl)
    if signal.status in ("win", "lose"):
        return pnl_usd_for_outcome(signal, signal.status)
    return 0.0


@dataclass(frozen=True)
class TrackerStats:
    wins: int
    trades_count: int
    winrate: float
    trading_days: int
    daily_loss_usd: float
    daily_loss_pct: float
    daily_remaining_usd: float
    day_start_balance: float
    drawdown_pct: float


def compute_tracker_stats(
    ch: UserChallenge,
    closed: list[Signal],
    *,
    max_daily_loss_pct: float,
) -> TrackerStats:
    wins = sum(1 for s in closed if s.status == "win")
    total = len(closed)
    winrate = round(wins / total * 100, 1) if total else 0.0

    trading_days = len({msk_day_key(s.closed_at) for s in closed if msk_day_key(s.closed_at)})

    today_key = msk_day_key(datetime.now(timezone.utc))
    today_closed = [s for s in closed if msk_day_key(s.closed_at) == today_key]
    net_pnl_today = round(sum(signal_pnl_usd(s) for s in today_closed), 2)
    daily_loss_usd = round(
        sum(abs(signal_pnl_usd(s)) for s in today_closed if signal_pnl_usd(s) < 0),
        2,
    )

    balance = ch.balance
    day_start_balance = round(balance - net_pnl_today, 2)
    max_daily_usd = day_start_balance * max_daily_loss_pct / 100.0
    daily_remaining_usd = round(max(0.0, max_daily_usd - daily_loss_usd), 2)
    daily_loss_pct = round(
        (daily_loss_usd / day_start_balance * 100.0) if day_start_balance > 0 else 0.0,
        2,
    )

    start = ch.account_size
    drawdown_pct = round(
        max(0.0, (start - balance) / start * 100.0) if start > 0 and balance < start else 0.0,
        2,
    )

    return TrackerStats(
        wins=wins,
        trades_count=total,
        winrate=winrate,
        trading_days=trading_days,
        daily_loss_usd=daily_loss_usd,
        daily_loss_pct=daily_loss_pct,
        daily_remaining_usd=daily_remaining_usd,
        day_start_balance=day_start_balance,
        drawdown_pct=drawdown_pct,
    )
