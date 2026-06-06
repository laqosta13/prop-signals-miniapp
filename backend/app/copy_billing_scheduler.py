"""Периодическое списание комиссии копирования с депозита."""

from __future__ import annotations

import asyncio
import logging

from sqlalchemy import select

from app.bybit_trading import BybitCredentials, get_wallet_usdt_balance
from app.copy_billing import settle_copy_fees_from_deposit
from app.credentials_crypto import decrypt_secret
from app.database import SessionLocal
from app.models import UserBybitSettings

logger = logging.getLogger(__name__)

_CHECK_INTERVAL_SEC = 3600


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
            settle_copy_fees_from_deposit(db, row.telegram_user_id, row, equity)
            if equity is not None:
                count += 1
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
    return count


async def copy_billing_scheduler_loop() -> None:
    logger.info("Copy deposit settlement scheduler started (interval=%ss)", _CHECK_INTERVAL_SEC)
    while True:
        try:
            n = await run_copy_billing_once()
            if n:
                logger.info("Copy deposit settlement: %s user(s)", n)
        except Exception as e:
            logger.exception("copy_billing_scheduler: %s", e)
        await asyncio.sleep(_CHECK_INTERVAL_SEC)
