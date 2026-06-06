"""Мониторинг активных сигналов: вход/выход по первой бирже, где достигнут уровень."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.config import settings
from app.cult_channel_service import apply_outcome_to_channel
from app.database import SessionLocal
from app.models import CultChannel, CultChannelSignal, Signal
from app.price_service import (
    clear_price_cache,
    fetch_market_quotes,
    first_entry_quote,
    first_outcome_quote,
    normalize_symbol,
)
from app.copy_trading_service import open_signal_copies, open_signal_copy_for_user
from app.signal_service import after_limit_entry_filled, close_signal_and_notify, notify_entry_filled_if_needed
from app.signal_utils import entry_zone_defined, monitor_exit_price

logger = logging.getLogger(__name__)


def _signal_awaits_entry(signal: Signal | CultChannelSignal) -> bool:
    return signal.entry_filled_at is None and entry_zone_defined(signal.entry_low, signal.entry_high)


async def check_active_signals_once() -> tuple[int, bool]:
    """Закрытие сигналов и отметка входа. Возвращает (число закрытий, есть ли ожидание лимитки)."""
    closed = 0
    awaits_entry = False
    clear_price_cache()
    db = SessionLocal()
    try:
        admin_active = list(
            db.scalars(
                select(Signal).where(
                    Signal.status == "active",
                    Signal.is_cult_candidate.is_(False),
                )
            ).all()
        )
        cult_trader_active = list(
            db.scalars(
                select(Signal).where(
                    Signal.status == "active",
                    Signal.is_cult_candidate.is_(True),
                )
            ).all()
        )
        cult_active = list(db.scalars(select(CultChannelSignal).where(CultChannelSignal.status == "active")).all())

        symbols = sorted(
            {normalize_symbol(s.symbol) for s in admin_active}
            | {normalize_symbol(s.symbol) for s in cult_trader_active}
            | {normalize_symbol(s.symbol) for s in cult_active}
        )
        if not symbols:
            return 0, False

        awaits_entry = any(
            _signal_awaits_entry(s)
            for s in (*admin_active, *cult_trader_active, *cult_active)
        )

        quote_lists = await asyncio.gather(*(fetch_market_quotes(sym) for sym in symbols))
        quotes_by_symbol = dict(zip(symbols, quote_lists, strict=True))

        for signal in admin_active:
            try:
                sym = normalize_symbol(signal.symbol)
                quotes = quotes_by_symbol.get(sym) or []
                if not quotes:
                    logger.warning("Монитор: нет цен для %s (signal #%s)", signal.symbol, signal.id)
                    continue

                if signal.entry_filled_at is None:
                    if not entry_zone_defined(signal.entry_low, signal.entry_high):
                        continue
                    hit = first_entry_quote(quotes, signal.direction, signal.entry_low, signal.entry_high)
                    if hit is None:
                        continue
                    signal.entry_filled_at = datetime.now(timezone.utc)
                    db.commit()
                    db.refresh(signal)
                    logger.info(
                        "Монитор: вход signal #%s %s, %s=%.4f",
                        signal.id,
                        signal.symbol,
                        hit.source,
                        hit.price,
                    )
                    await after_limit_entry_filled(db, signal)
                    continue

                if signal.entry_notified_at is None:
                    await notify_entry_filled_if_needed(db, signal)

                outcome_hit = first_outcome_quote(
                    quotes, signal.direction, signal.stop_loss, signal.take_profits
                )
                if outcome_hit is None:
                    continue
                outcome, hit = outcome_hit
                if outcome in ("win", "lose"):
                    exit_px = monitor_exit_price(
                        outcome,
                        direction=signal.direction,
                        stop_loss=signal.stop_loss,
                        take_profits=signal.take_profits,
                        market_price=hit.price,
                    )
                    logger.info(
                        "Монитор: %s signal #%s %s, %s=%.4f → exit=%.4f",
                        outcome,
                        signal.id,
                        signal.symbol,
                        hit.source,
                        hit.price,
                        exit_px,
                    )
                    await close_signal_and_notify(
                        db,
                        signal,
                        outcome,
                        exit_price=exit_px,
                        close_reason="target" if outcome == "win" else "stop",
                    )
                    closed += 1
            except Exception:
                logger.exception("Монитор: ошибка signal #%s", signal.id)

        for signal in cult_trader_active:
            sym = normalize_symbol(signal.symbol)
            quotes = quotes_by_symbol.get(sym) or []
            if not quotes:
                continue
            if signal.entry_filled_at is None:
                if not entry_zone_defined(signal.entry_low, signal.entry_high):
                    continue
                hit = first_entry_quote(quotes, signal.direction, signal.entry_low, signal.entry_high)
                if hit is None:
                    continue
                signal.entry_filled_at = datetime.now(timezone.utc)
                db.commit()
                logger.info("CULT кандидат: вход #%s %s", signal.id, signal.symbol)
                await open_signal_copy_for_user(db, signal, signal.author_telegram_id)
                continue
            outcome_hit = first_outcome_quote(quotes, signal.direction, signal.stop_loss, signal.take_profits)
            if outcome_hit is None:
                continue
            outcome, hit = outcome_hit
            if outcome in ("win", "lose"):
                exit_px = monitor_exit_price(
                    outcome,
                    direction=signal.direction,
                    stop_loss=signal.stop_loss,
                    take_profits=signal.take_profits,
                    market_price=hit.price,
                )
                await close_signal_and_notify(
                    db,
                    signal,
                    outcome,
                    exit_price=exit_px,
                    close_reason="target" if outcome == "win" else "stop",
                )
                closed += 1

        channels = {c.id: c for c in db.scalars(select(CultChannel)).all()}
        for sig in cult_active:
            channel = channels.get(sig.cult_channel_id)
            if channel is None:
                continue
            sym = normalize_symbol(sig.symbol)
            quotes = quotes_by_symbol.get(sym) or []
            if not quotes:
                continue

            if sig.entry_filled_at is None:
                if not entry_zone_defined(sig.entry_low, sig.entry_high):
                    continue
                hit = first_entry_quote(quotes, sig.direction, sig.entry_low, sig.entry_high)
                if hit is None:
                    continue
                sig.entry_filled_at = datetime.now(timezone.utc)
                db.commit()
                logger.info("CULT: вход #%s %s @%s", sig.id, sig.symbol, channel.username)
                continue

            outcome_hit = first_outcome_quote(quotes, sig.direction, sig.stop_loss, sig.take_profits)
            if outcome_hit is None:
                continue
            outcome, hit = outcome_hit
            if outcome in ("win", "lose"):
                exit_px = monitor_exit_price(
                    outcome,
                    direction=sig.direction,
                    stop_loss=sig.stop_loss,
                    take_profits=sig.take_profits,
                    market_price=hit.price,
                )
                if not apply_outcome_to_channel(db, channel, sig, outcome, exit_px):
                    continue
                db.commit()
                logger.info("CULT: %s #%s %s @%s", outcome, sig.id, sig.symbol, channel.username)
                closed += 1
    except Exception as e:
        logger.exception("price monitor error: %s", e)
        db.rollback()
    finally:
        db.close()
    return closed, awaits_entry


async def price_monitor_loop() -> None:
    slow = settings.price_check_interval_seconds
    fast = settings.price_entry_check_interval_seconds
    logger.info(
        "Price monitor started, entry_interval=%ss, in_market_interval=%ss",
        fast,
        slow,
    )
    while True:
        interval = fast
        try:
            n, awaits_entry = await check_active_signals_once()
            interval = fast if awaits_entry else slow
            if n:
                logger.info("Closed %s signal(s)", n)
        except Exception as e:
            logger.exception("monitor loop: %s", e)
        await asyncio.sleep(interval)
