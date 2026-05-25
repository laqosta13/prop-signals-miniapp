"""P/L и рейтинг: номинал = трекер × сумма входа %; результат = % движения цены × номинал."""

from app.models import Signal, Trader
from app.signal_utils import trade_move_pct


def signal_entry_stake_pct(signal: Signal) -> float:
    """Доля входа от трекера, % (хранится в risk_percent)."""
    if signal.risk_percent is not None:
        return float(signal.risk_percent)
    if signal.points_percent is not None:
        return float(signal.points_percent)
    return 1.0


def signal_risk_percent(signal: Signal) -> float:
    return signal_entry_stake_pct(signal)


def signal_tracker_balance(signal: Signal) -> float:
    if signal.tracker_balance is not None and signal.tracker_balance > 0:
        return float(signal.tracker_balance)
    return 10_000.0


def signal_entry_stake_usd(signal: Signal) -> float:
    """Номинал позиции в $: трекер × сумма входа % / 100."""
    return round(signal_tracker_balance(signal) * signal_entry_stake_pct(signal) / 100.0, 2)


def signal_trade_return_pct(signal: Signal, outcome: str, exit_price: float | None = None) -> float:
    """Доходность сделки в % от номинала (движение цены вход→выход)."""
    return trade_move_pct(
        signal.entry_low,
        signal.entry_high,
        signal.direction,
        outcome,
        exit_price=exit_price,
        stop_loss=signal.stop_loss,
        take_profits=signal.take_profits,
    )


def pnl_usd_for_outcome(signal: Signal, outcome: str, exit_price: float | None = None) -> float:
    move = signal_trade_return_pct(signal, outcome, exit_price)
    base = signal_entry_stake_usd(signal)
    return round(base * move / 100.0, 2)


def apply_outcome_to_trader(
    trader: Trader,
    signal: Signal,
    outcome: str,
    exit_price: float | None = None,
) -> None:
    move_pct = signal_trade_return_pct(signal, outcome, exit_price)
    pnl = pnl_usd_for_outcome(signal, outcome, exit_price)
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
    else:
        trader.losses += 1

    trader.rating_percent = round(trader.rating_percent + move_pct, 2)
    trader.total_pnl_usd = round(trader.total_pnl_usd + pnl, 2)

    from app.rank_service import add_weekly_pct

    add_weekly_pct(trader, move_pct)
