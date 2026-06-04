"""Long-polling Telegram updates для постов каналов-кандидатов."""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path

from app.config import settings
from app.cult_channel_service import ingest_channel_post
from app.database import SessionLocal
from app.media_storage import media_root
from app.support_chat import live_chat_enabled, process_support_group_message
from app.telegram_bot_api import delete_webhook, get_updates

logger = logging.getLogger(__name__)

_OFFSET_FILE = "telegram_update_offset.txt"


def _offset_path() -> Path:
    return media_root() / _OFFSET_FILE


def _load_offset() -> int | None:
    p = _offset_path()
    if not p.is_file():
        return None
    try:
        return int(p.read_text().strip())
    except ValueError:
        return None


def _save_offset(offset: int) -> None:
    _offset_path().write_text(str(offset))


async def process_updates_once() -> int:
    if not settings.bot_token:
        return 0

    db = SessionLocal()
    try:
        offset = _load_offset()
        updates = await get_updates(offset=offset, timeout=0 if offset is None else 25)
        if not updates:
            return 0

        processed = 0
        next_offset: int | None = None

        for upd in updates:
            upd_id = int(upd["update_id"])
            next_offset = upd_id + 1

            msg = upd.get("message")
            if msg and live_chat_enabled():
                try:
                    if await process_support_group_message(db, msg):
                        processed += 1
                except Exception:
                    logger.exception("support group message failed update_id=%s", upd_id)
                    db.rollback()
                    return 0

            msg = upd.get("channel_post")
            is_edit = False
            if not msg:
                msg = upd.get("edited_channel_post")
                is_edit = bool(msg)

            if not msg:
                continue

            chat = msg.get("chat") or {}
            chat_id = chat.get("id")
            if chat_id is None:
                logger.warning("channel update without chat.id: %s", upd_id)
                continue

            try:
                sig = ingest_channel_post(db, int(chat_id), msg, is_edit=is_edit)
            except Exception:
                logger.exception("ingest channel post failed update_id=%s", upd_id)
                db.rollback()
                return 0

            if sig:
                processed += 1
                logger.info(
                    "CULT channel signal #%s %s from @%s%s",
                    sig.id,
                    sig.symbol,
                    chat.get("username"),
                    " (edit)" if is_edit else "",
                )

        db.commit()
        if next_offset is not None:
            _save_offset(next_offset)
    except Exception as e:
        logger.exception("telegram updates error: %s", e)
        db.rollback()
    finally:
        db.close()
    return processed


async def telegram_updates_loop() -> None:
    if not settings.bot_token:
        logger.info("telegram_updates: BOT_TOKEN missing, skip")
        return
    await asyncio.to_thread(delete_webhook)
    logger.info("telegram_updates: polling channel_post + support messages")
    while True:
        try:
            await process_updates_once()
            await asyncio.sleep(2)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.exception("telegram_updates_loop: %s", e)
            await asyncio.sleep(10)
