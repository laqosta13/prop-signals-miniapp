from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from app.database import SessionLocal
from app.rank_service import process_monday_rollover

logger = logging.getLogger(__name__)

_CHECK_INTERVAL_SEC = 3600


def _is_monday_rollover_window(now: datetime) -> bool:
    """Понедельник 00:00–00:59 UTC."""
    return now.weekday() == 0 and now.hour == 0


async def rank_scheduler_loop() -> None:
    last_run_key: str | None = None
    while True:
        try:
            now = datetime.now(timezone.utc)
            key = now.strftime("%Y-%m-%d")
            if _is_monday_rollover_window(now) and key != last_run_key:
                db = SessionLocal()
                try:
                    process_monday_rollover(db)
                    db.commit()
                    last_run_key = key
                finally:
                    db.close()
        except Exception as e:
            logger.exception("rank_scheduler: %s", e)
        await asyncio.sleep(_CHECK_INTERVAL_SEC)
