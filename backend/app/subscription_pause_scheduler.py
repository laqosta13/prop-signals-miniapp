"""Ежедневная пауза подписки в дни без сигналов (MSK)."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from app.database import SessionLocal
from app.subscription_pause import run_subscription_pause_once

logger = logging.getLogger(__name__)

MSK = ZoneInfo("Europe/Moscow")

_CHECK_INTERVAL_SEC = 3600


def _is_msk_midnight_window(now: datetime) -> bool:
    """00:00–00:59 MSK — обработка вчерашнего дня."""
    return now.astimezone(MSK).hour == 0


def run_subscription_pause_sync() -> int:
    db = SessionLocal()
    try:
        n = run_subscription_pause_once(db)
        db.commit()
        return n
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


async def subscription_pause_scheduler_loop() -> None:
    last_run_key: str | None = None
    logger.info("Subscription pause scheduler started")
    while True:
        try:
            now = datetime.now(timezone.utc)
            msk_key = now.astimezone(MSK).strftime("%Y-%m-%d")
            if _is_msk_midnight_window(now) and msk_key != last_run_key:
                n = run_subscription_pause_sync()
                if n:
                    logger.info("Subscription pause: +1 day for %s subscriber(s)", n)
                last_run_key = msk_key
        except Exception as e:
            logger.exception("subscription_pause_scheduler: %s", e)
        await asyncio.sleep(_CHECK_INTERVAL_SEC)
