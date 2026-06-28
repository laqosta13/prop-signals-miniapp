"""DTO активных сделок для карточек volnovoi и CULT."""

from __future__ import annotations

from app.models import Signal
from app.schemas import CultCandidateActiveSignalRead
from app.signal_utils import format_signal_entry_display, signal_awaiting_entry, signal_in_trade
from app.trader_stats import signal_entry_stake_pct, signal_leverage


def build_active_signal_read(signal: Signal) -> CultCandidateActiveSignalRead:
    stake = signal_entry_stake_pct(signal)
    lev = signal_leverage(signal)
    entry = format_signal_entry_display(
        signal.entry_low,
        signal.entry_high,
        signal.published_market_price,
    )
    awaiting = signal_awaiting_entry(signal)
    in_market = signal_in_trade(signal)
    if awaiting:
        level_label = "ожидание входа"
    elif in_market:
        if signal.stop_loss:
            level_label = f"стоп {signal.stop_loss}"
        elif signal.take_profits:
            tp = (signal.take_profits or "").split(",")[0].strip()
            level_label = f"цель {tp}" if tp else "в рынке"
        else:
            level_label = "в рынке"
    else:
        level_label = "активна"
    return CultCandidateActiveSignalRead(
        id=signal.id,
        symbol=signal.symbol,
        direction=signal.direction,
        entry=entry,
        level_label=level_label,
        stake_percent=float(stake),
        leverage=lev,
        stop_loss=signal.stop_loss,
        take_profits=signal.take_profits,
        in_market=in_market,
        awaiting_entry=awaiting,
        entry_low=signal.entry_low,
        entry_high=signal.entry_high,
        created_at=signal.created_at,
        entry_filled_at=signal.entry_filled_at,
    )
