"""Рейтинг: ±% поля «сумма входа»; P/L $ = трекер × этот % / 100."""

from app.models import Signal, Trader


def signal_entry_stake_pct(signal: Signal) -> float:
    """Доля входа от трекера, % (хранится в risk_percent)."""
    if signal.risk_percent is not None:
        return float(signal.risk_percent)
    if signal.points_percent is not None:
        return float(signal.points_percent)
    return 1.0


# alias для совместимости
def signal_risk_percent(signal: Signal) -> float:
    return signal_entry_stake_pct(signal)


def signal_tracker_balance(signal: Signal) -> float:
    if signal.tracker_balance is not None and signal.tracker_balance > 0:
        return float(signal.tracker_balance)
    return 10_000.0


def signal_entry_stake_usd(signal: Signal) -> float:
    """Номинал позиции в $: трекер × сумма входа % / 100."""
    return round(signal_tracker_balance(signal) * signal_entry_stake_pct(signal) / 100.0, 2)


def pnl_usd_for_outcome(signal: Signal, outcome: str) -> float:
    base = signal_entry_stake_usd(signal)
    return round(base if outcome == "win" else -base, 2)


def apply_outcome_to_trader(trader: Trader, signal: Signal, outcome: str) -> None:
    risk_pct = signal_entry_stake_pct(signal)
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
        trader.total_pnl_usd = round(trader.total_pnl_usd + pnl, 2)
    else:
        trader.losses += 1
        trader.rating_percent = round(trader.rating_percent - risk_pct, 2)
        trader.total_pnl_usd = round(trader.total_pnl_usd + pnl, 2)
