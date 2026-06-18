"""Периодическая доставка капсул времени через Telegram бот."""

from __future__ import annotations

import asyncio
import html
import logging
from datetime import timezone

from app.credentials_crypto import decrypt_secret
from app.database import SessionLocal
from app.time_capsule_service import mark_delivered, pending_capsules

logger = logging.getLogger(__name__)

_CHECK_INTERVAL_SEC = 300


def _format_capsule_message(message: str, created_at) -> str:
    from_date = ""
    if created_at is not None:
        dt = created_at
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        from_date = dt.strftime("%d.%m.%Y")
    safe = html.escape(message)
    header = f"📬 <b>Капсула времени</b>"
    if from_date:
        header += f" <i>(отправлено {from_date})</i>"
    return f"{header}\n\n<code>{safe}</code>"


async def deliver_pending_capsules() -> int:
    from app.telegram_notify import _send_message  # local import to avoid circular

    db = SessionLocal()
    delivered = 0
    try:
        capsules = pending_capsules(db)
        for capsule in capsules:
            try:
                plaintext = decrypt_secret(capsule.message)
            except Exception:
                logger.error("TimeCapsule #%s: decrypt failed, skipping", capsule.id)
                continue
            text = _format_capsule_message(plaintext, capsule.created_at)
            ok = await _send_message(capsule.telegram_user_id, text)
            if ok:
                mark_delivered(db, capsule)
                delivered += 1
                logger.info("TimeCapsule #%s delivered to user=%s", capsule.id, capsule.telegram_user_id)
            else:
                logger.warning("TimeCapsule #%s delivery failed user=%s", capsule.id, capsule.telegram_user_id)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
    return delivered


async def time_capsule_scheduler_loop() -> None:
    logger.info("Time capsule scheduler started (interval=%ss)", _CHECK_INTERVAL_SEC)
    while True:
        try:
            n = await deliver_pending_capsules()
            if n:
                logger.info("Time capsule: delivered %s capsule(s)", n)
        except Exception as e:
            logger.exception("time_capsule_scheduler: %s", e)
        await asyncio.sleep(_CHECK_INTERVAL_SEC)
