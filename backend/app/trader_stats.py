"""Рейтинг трейдера: ±risk% и P/L в $ от суммы трекера сигнала."""

from app.models import Signal, Trader


def signal_risk_percent(signal: Signal) -> float:
    if signal.risk_percent is not None:
        return float(signal.risk_percent)
    if signal.points_percent is not None:
        return float(signal.points_percent)
    return 1.0


def signal_tracker_balance(signal: Signal) -> float:
    if signal.tracker_balance is not None and signal.tracker_balance > 0:
        return float(signal.tracker_balance)
    return 10_000.0


def pnl_usd_for_outcome(signal: Signal, outcome: str) -> float:
    """P/L в долларах: трекер × риск% / 100. WIN +, LOSE −."""
    base = signal_tracker_balance(signal) * signal_risk_percent(signal) / 100.0
    return round(base if outcome == "win" else -base, 2)


def apply_outcome_to_trader(trader: Trader, signal: Signal, outcome: str) -> None:
    risk_pct = signal_risk_percent(signal)
    pnl = pnl_usd_for_outcome(signal, outcome)
    signal.realized_pnl = pnl
    if trader.total_pnl_usd is None:
        trader.total_pnl_usd = 0.0
    if trader.rating_percent is None:
        trader.rating_percent = 0.0
    if trader.wins is None:
        trader.wins = 0
    if trader.losses is None:
        trader.losses = 0

    if outcome == "win":
        trader.wins += 1
        trader.rating_percent = round(trader.rating_percent + risk_pct, 2)
        trader.total_pnl_usd = round(trader.total_pnl_usd + abs(pnl), 2)
    else:
        trader.losses += 1
        trader.rating_percent = round(trader.rating_percent - risk_pct, 2)
        trader.total_pnl_usd = round(trader.total_pnl_usd + pnl, 2)  # pnl уже отрицательный
