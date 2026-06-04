"""Регистрация подписчика по команде /start в личке бота (без ответного сообщения)."""

from __future__ import annotations

import logging
import re

from sqlalchemy.orm import Session

from app.subscription_billing import register_subscriber_with_meta

logger = logging.getLogger(__name__)

_START_RE = re.compile(r"^/start(?:@\w+)?(?:\s+(\S+))?\s*$", re.IGNORECASE)


def parse_start_command(text: str) -> str | None:
    """None — не /start; иначе реферальный код (может быть пустой строкой)."""
    m = _START_RE.match((text or "").strip())
    if not m:
        return None
    return (m.group(1) or "").strip()


async def process_bot_start_message(db: Session, message: dict) -> bool:
    """Личка: /start → регистрация (если новый), без приветствия в чат."""
    chat = message.get("chat") or {}
    if chat.get("type") != "private":
        return False

    from_user = message.get("from") or {}
    if from_user.get("is_bot"):
        return False

    uid = int(from_user.get("id") or 0)
    if uid <= 0:
        return False

    start_param = parse_start_command(str(message.get("text") or ""))
    if start_param is None:
        return False

    username = from_user.get("username")
    if isinstance(username, str):
        username = username.strip() or None
    else:
        username = None

    try:
        register_subscriber_with_meta(
            db,
            uid,
            username,
            start_param or None,
        )
        db.flush()
    except Exception:
        logger.exception("bot /start register failed uid=%s", uid)
        db.rollback()
        return False

    logger.info("bot /start register uid=%s ref=%r", uid, start_param or None)
    return True
