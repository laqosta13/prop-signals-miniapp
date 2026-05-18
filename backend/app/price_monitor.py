from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models import Signal
from app.price_service import clear_price_cache, fetch_price
from app.signal_service import close_signal_and_notify, notify_entry_filled
from app.signal_utils import evaluate_signal, price_in_entry_zone

logger = logging.getLogger(__name__)


async def check_active_signals_once() -> int:
    """Закрытие сигналов и отметка входа в зоне. Возвращает число закрытий."""
    closed = 0
    clear_price_cache()
    db = SessionLocal()
    try:
        stmt = select(Signal).where(Signal.status == "active")
        active = list(db.scalars(stmt).all())
        symbols = {s.symbol for s in active}
        prices: dict[str, float] = {}
        for sym in symbols:
            p = await fetch_price(sym)
            if p is not None:
                prices[sym.upper()] = p

        for signal in active:
            price = prices.get(signal.symbol.upper())
            if price is None:
                continue

            if signal.entry_filled_at is None:
                if price_in_entry_zone(price, signal.entry_low, signal.entry_high):
                    signal.entry_filled_at = datetime.now(timezone.utc)
                    db.commit()
                    await notify_entry_filled(db, signal)
                continue

            outcome = evaluate_signal(price, signal.direction, signal.stop_loss, signal.take_profits)
            if outcome in ("win", "lose"):
                await close_signal_and_notify(db, signal, outcome)
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
