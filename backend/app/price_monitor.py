from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.config import settings
from app.database import SessionLocal
from app.models import Signal
from app.price_service import clear_price_cache, fetch_price, normalize_symbol
from app.signal_service import close_signal_and_notify, notify_entry_filled
from app.signal_utils import entry_zone_defined, evaluate_signal, entry_triggered

logger = logging.getLogger(__name__)


async def check_active_signals_once() -> int:
    """Закрытие сигналов и отметка входа в зоне. Возвращает число закрытий."""
    closed = 0
    clear_price_cache()
    db = SessionLocal()
    try:
        stmt = select(Signal).where(Signal.status == "active")
        active = list(db.scalars(stmt).all())
        if not active:
            return 0

        symbols = {normalize_symbol(s.symbol) for s in active}
        prices: dict[str, float] = {}
        for sym in symbols:
            p = await fetch_price(sym)
            if p is not None:
                prices[sym] = p

        for signal in active:
            sym = normalize_symbol(signal.symbol)
            price = prices.get(sym)
            if price is None:
                logger.warning("Монитор: нет цены для %s (signal #%s)", signal.symbol, signal.id)
                continue

            if signal.entry_filled_at is None:
                if entry_zone_defined(signal.entry_low, signal.entry_high) and entry_triggered(
                    price, signal.direction, signal.entry_low, signal.entry_high
                ):
                    signal.entry_filled_at = datetime.now(timezone.utc)
                    db.commit()
                    logger.info(
                        "Монитор: вход signal #%s %s, market=%.4f",
                        signal.id,
                        signal.symbol,
                        price,
                    )
                    await notify_entry_filled(db, signal)
                continue

            outcome = evaluate_signal(price, signal.direction, signal.stop_loss, signal.take_profits)
            if outcome in ("win", "lose"):
                await close_signal_and_notify(db, signal, outcome, exit_price=price)
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
