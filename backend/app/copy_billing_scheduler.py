"""Ежедневное выставление счетов за копирование volnovoi."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.bybit_trading import BybitCredentials, get_wallet_usdt_balance
from app.copy_billing import upsert_daily_invoice
from app.credentials_crypto import decrypt_secret
from app.database import SessionLocal
from app.models import UserBybitSettings

logger = logging.getLogger(__name__)

_CHECK_INTERVAL_SEC = 3600


def _is_daily_billing_window(now: datetime) -> bool:
    """00:00–00:59 UTC — раз в сутки."""
    return now.hour == 0


async def run_copy_billing_once() -> int:
    db = SessionLocal()
    count = 0
    try:
        rows = list(db.scalars(select(UserBybitSettings).where(UserBybitSettings.enabled.is_(True))).all())
        for row in rows:
            try:
                creds = BybitCredentials(
                    api_key=decrypt_secret(row.api_key_encrypted),
                    api_secret=decrypt_secret(row.api_secret_encrypted),
                )
                equity = await get_wallet_usdt_balance(creds)
            except Exception as e:
                logger.warning("Copy billing: user=%s balance error: %s", row.telegram_user_id, e)
                continue
            inv = upsert_daily_invoice(db, row, equity)
            if inv is not None:
                count += 1
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
    return count


async def copy_billing_scheduler_loop() -> None:
    last_run_key: str | None = None
    logger.info("Copy billing scheduler started")
    while True:
        try:
            now = datetime.now(timezone.utc)
            key = now.strftime("%Y-%m-%d")
            if _is_daily_billing_window(now) and key != last_run_key:
                n = await run_copy_billing_once()
                if n:
                    logger.info("Copy billing: %s invoice(s) updated", n)
                last_run_key = key
        except Exception as e:
            logger.exception("copy_billing_scheduler: %s", e)
        await asyncio.sleep(_CHECK_INTERVAL_SEC)
