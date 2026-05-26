"""Мониторинг активных сигналов: вход/выход по первой бирже, где достигнут уровень."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.config import settings
from app.database import SessionLocal
from app.models import Signal
from app.price_service import (
    clear_price_cache,
    fetch_market_quotes,
    first_entry_quote,
    first_outcome_quote,
    normalize_symbol,
)
from app.signal_service import close_signal_and_notify, notify_entry_filled
from app.signal_utils import entry_zone_defined

logger = logging.getLogger(__name__)


async def check_active_signals_once() -> int:
    """Закрытие сигналов и отметка входа. Возвращает число закрытий."""
    closed = 0
    clear_price_cache()
    db = SessionLocal()
    try:
        stmt = select(Signal).where(Signal.status == "active")
        active = list(db.scalars(stmt).all())
        if not active:
            return 0

        symbols = {normalize_symbol(s.symbol) for s in active}
        quotes_by_symbol: dict[str, list] = {}
        for sym in symbols:
            quotes_by_symbol[sym] = await fetch_market_quotes(sym)

        for signal in active:
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
                logger.info(
                    "Монитор: вход signal #%s %s, %s=%.4f",
                    signal.id,
                    signal.symbol,
                    hit.source,
                    hit.price,
                )
                await notify_entry_filled(db, signal)
                continue

            outcome_hit = first_outcome_quote(
                quotes, signal.direction, signal.stop_loss, signal.take_profits
            )
            if outcome_hit is None:
                continue
            outcome, hit = outcome_hit
            if outcome in ("win", "lose"):
                logger.info(
                    "Монитор: %s signal #%s %s, %s=%.4f",
                    outcome,
                    signal.id,
                    signal.symbol,
                    hit.source,
                    hit.price,
                )
                await close_signal_and_notify(db, signal, outcome, exit_price=hit.price)
                closed += 1
    except Exception as e:
        logger.exception("price monitor error: %s", e)
        db.rollback()
    finally:
        db.close()
    return closed


async def price_monitor_loop() -> None:
    interval = settings.price_check_interval_seconds
    logger.info("Price monitor started, interval=%ss", interval)
    while True:
        try:
            n = await check_active_signals_once()
            if n:
                logger.info("Closed %s signal(s)", n)
        except Exception as e:
            logger.exception("monitor loop: %s", e)
        await asyncio.sleep(interval)
