"""Лайв-чат поддержки: Mini App ↔ группа Telegram (ответ админа — reply на сообщение бота)."""

from __future__ import annotations

import asyncio
import html
import logging

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import SupportMessage, SupportThread
from app.telegram_bot_api import TelegramApiError, get_chat, send_message

logger = logging.getLogger(__name__)

MAX_USER_TEXT = 2000
MAX_STAFF_TEXT = 4000


def support_group_id() -> int | None:
    raw = (settings.telegram_support_group_id or "").strip()
    if not raw:
        return None
    try:
        return int(raw)
    except ValueError:
        return None


def live_chat_enabled() -> bool:
    return support_group_id() is not None and bool(settings.bot_token)


def map_telegram_send_error(description: str) -> str:
    """Код ошибки для API (не HTTP 503 — Amvera подменяет 503 HTML-страницей)."""
    d = description.lower()
    if "chat not found" in d:
        return "support_group_not_found"
    if "bot is not a member" in d or "kicked from" in d or "user is deactivated" in d:
        return "support_bot_not_in_group"
    if "not enough rights" in d or "can't write" in d or "have no rights" in d:
        return "support_bot_no_send_rights"
    if "group chat was upgraded" in d:
        return "support_group_id_outdated"
    if "parse" in d or "can't parse" in d:
        return "support_message_format"
    return "group_send_failed"


def verify_support_group_at_startup() -> None:
    """Проверка TELEGRAM_SUPPORT_GROUP_ID (логи Amvera). Не бросает исключений."""
    gid = support_group_id()
    if gid is None:
        return
    if not settings.bot_token:
        logger.warning("support: TELEGRAM_SUPPORT_GROUP_ID задан, но BOT_TOKEN пуст")
        return

    try:
        chat = get_chat(gid)
        title = (chat.get("title") or chat.get("username") or "?").strip()
        logger.info("support: группа ok id=%s title=%r", gid, title)
    except httpx.HTTPError as e:
        logger.warning(
            "support: getChat — сеть/Telegram недоступны id=%s (%s). Чат попробует отправку при сообщении пользователя.",
            gid,
            e,
        )
    except ValueError as e:
        logger.error("support: группа недоступна id=%s — %s", gid, e)
    except TelegramApiError as e:
        logger.error("support: getChat failed id=%s — %s", gid, e)
    except Exception as e:
        logger.warning("support: getChat unexpected id=%s — %s", gid, e)


async def verify_support_group_after_delay(delay_sec: float = 15.0) -> None:
    """Повтор проверки, когда сеть на Amvera уже поднялась."""
    await asyncio.sleep(delay_sec)
    await asyncio.to_thread(verify_support_group_at_startup)


def _user_label(*, username: str | None, telegram_user_id: int, first_name: str | None = None) -> str:
    if username:
        return f"@{username.lstrip('@')}"
    if first_name:
        return html.escape(first_name.strip())
    return f"id {telegram_user_id}"


def _format_group_user_message(
    *,
    username: str | None,
    telegram_user_id: int,
    first_name: str | None,
    text: str,
    first_in_thread: bool,
) -> str:
    who = _user_label(username=username, telegram_user_id=telegram_user_id, first_name=first_name)
    body = html.escape(text.strip())
    if first_in_thread:
        return (
            f"📩 <b>Поддержка</b> · {who} · <code>{telegram_user_id}</code>\n"
            f"<i>Ответьте реплаем на это сообщение</i>\n"
            f"────────\n{body}"
        )
    return f"💬 {who}:\n{body}"


def get_or_create_thread(db: Session, telegram_user_id: int) -> SupportThread:
    row = db.scalar(select(SupportThread).where(SupportThread.telegram_user_id == telegram_user_id))
    if row:
        return row
    row = SupportThread(telegram_user_id=telegram_user_id)
    db.add(row)
    db.flush()
    return row


def list_messages(db: Session, telegram_user_id: int, *, after_id: int = 0) -> list[SupportMessage]:
    thread = db.scalar(select(SupportThread).where(SupportThread.telegram_user_id == telegram_user_id))
    if thread is None:
        return []
    q = (
        select(SupportMessage)
        .where(SupportMessage.thread_id == thread.id, SupportMessage.id > after_id)
        .order_by(SupportMessage.id.asc())
        .limit(200)
    )
    return list(db.scalars(q).all())


async def post_user_message(
    db: Session,
    *,
    telegram_user_id: int,
    username: str | None,
    first_name: str | None,
    text: str,
) -> SupportMessage:
    if not live_chat_enabled():
        raise ValueError("support_chat_disabled")

    body = text.strip()
    if len(body) < 1:
        raise ValueError("empty_message")
    if len(body) > MAX_USER_TEXT:
        raise ValueError("message_too_long")

    gid = support_group_id()
    assert gid is not None

    thread = get_or_create_thread(db, telegram_user_id)
    prior = db.scalar(
        select(SupportMessage.id)
        .where(SupportMessage.thread_id == thread.id, SupportMessage.direction == "user")
        .limit(1)
    )
    first_in_thread = prior is None

    group_text = _format_group_user_message(
        username=username,
        telegram_user_id=telegram_user_id,
        first_name=first_name,
        text=body,
        first_in_thread=first_in_thread,
    )

    try:
        result = await send_message(gid, group_text, parse_mode="HTML")
    except TelegramApiError as e:
        code = map_telegram_send_error(str(e))
        logger.warning("support group send failed uid=%s gid=%s code=%s: %s", telegram_user_id, gid, code, e)
        raise ValueError(code) from e

    msg_id = int((result or {}).get("message_id") or 0)
    if msg_id <= 0:
        raise ValueError("group_send_failed")

    row = SupportMessage(
        thread_id=thread.id,
        direction="user",
        text=body,
        group_message_id=msg_id,
    )
    db.add(row)
    db.flush()
    return row


async def notify_user_staff_reply(telegram_user_id: int, text: str) -> None:
    preview = text.strip()
    if len(preview) > 500:
        preview = preview[:497] + "…"
    safe = html.escape(preview)
    sep = "┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈"
    await send_message(
        telegram_user_id,
        (
            f"💬 <b>ПОДДЕРЖКА</b>\n{sep}\n"
            f"<blockquote><b>Новый ответ</b></blockquote>"
            f"<i>Сообщение</i>\n{safe}\n\n"
            f"<i>Дубль в Mini App → Подписка → чат</i>"
        ),
        parse_mode="HTML",
    )


async def process_support_group_message(db: Session, message: dict) -> bool:
    """Ответ админа в группе (reply на сообщение пользователя от бота)."""
    gid = support_group_id()
    if gid is None:
        return False

    chat = message.get("chat") or {}
    if int(chat.get("id") or 0) != gid:
        return False

    from_user = message.get("from") or {}
    if from_user.get("is_bot"):
        return False

    admin_ids = settings.admin_id_set
    if admin_ids and int(from_user.get("id") or 0) not in admin_ids:
        logger.debug("support: ignore non-admin %s", from_user.get("id"))
        return False

    reply = message.get("reply_to_message")
    if not reply:
        return False

    reply_id = int(reply.get("message_id") or 0)
    if reply_id <= 0:
        return False

    staff_text = (message.get("text") or message.get("caption") or "").strip()
    if not staff_text:
        return False
    if len(staff_text) > MAX_STAFF_TEXT:
        staff_text = staff_text[:MAX_STAFF_TEXT]

    user_msg = db.scalar(
        select(SupportMessage).where(
            SupportMessage.group_message_id == reply_id,
            SupportMessage.direction == "user",
        )
    )
    if user_msg is None:
        return False

    thread = db.get(SupportThread, user_msg.thread_id)
    if thread is None:
        return False

    dup = db.scalar(
        select(SupportMessage.id).where(
            SupportMessage.thread_id == thread.id,
            SupportMessage.direction == "staff",
            SupportMessage.text == staff_text,
            SupportMessage.group_message_id == int(message.get("message_id") or 0),
        )
    )
    if dup:
        return True

    staff_row = SupportMessage(
        thread_id=thread.id,
        direction="staff",
        text=staff_text,
        group_message_id=int(message.get("message_id") or 0) or None,
    )
    db.add(staff_row)
    db.flush()

    try:
        await notify_user_staff_reply(thread.telegram_user_id, staff_text)
    except Exception:
        logger.exception("support notify user failed uid=%s", thread.telegram_user_id)

    logger.info("support reply uid=%s thread=%s", thread.telegram_user_id, thread.id)
    return True
