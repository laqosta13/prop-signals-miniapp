"""Приветствие в Telegram-боте по команде /start."""

from __future__ import annotations

import html
import logging
import re

from sqlalchemy.orm import Session

from app.config import settings
from app.subscription_billing import (
    TRIAL_DAYS,
    register_subscriber_with_meta,
    subscription_active,
)
from app.telegram_bot_api import send_message

logger = logging.getLogger(__name__)

_START_RE = re.compile(r"^/start(?:@\w+)?(?:\s+(\S+))?\s*$", re.IGNORECASE)


def parse_start_command(text: str) -> str | None:
    """None — не /start; иначе реферальный код (может быть пустой строкой)."""
    m = _START_RE.match((text or "").strip())
    if not m:
        return None
    return (m.group(1) or "").strip()


def build_bot_welcome_text(
    *,
    first_name: str | None,
    has_app_button: bool,
    trial_used: bool,
    has_active_sub: bool,
) -> str:
    who = html.escape((first_name or "").strip()) or "трейдер"
    trial = TRIAL_DAYS
    footer = (
        "Откройте приложение кнопкой ниже ↓"
        if has_app_button
        else "Откройте Mini App через меню бота (кнопка «Open» / «Запустить»)."
    )
    if has_active_sub:
        access_line = "Подписка активна — откройте ленту сигналов."
    elif trial_used:
        access_line = "Пробный период уже использован — оформите подписку в приложении."
    else:
        access_line = f"Вам доступен пробный период — <b>{trial} дн.</b> активных сигналов."
    return (
        f"👋 <b>Добро пожаловать, {who}!</b>\n\n"
        f"<b>Volnovoi Cult</b> — marketplace крипто-сделок.\n"
        "Прозрачная витрина сделок: ранги и отбор — в топ только лучшие трейдеры.\n\n"
        "• <b>Лента</b> — сигналы после отбора\n"
        "• <b>ТОП</b> — рейтинг и volnovoi\n"
        "• <b>Трекер</b> — Hash Hedge\n"
        f"• {access_line}\n\n"
        f"{footer}"
    )


def build_mini_app_keyboard() -> dict | None:
    url = (settings.mini_app_url or "").strip()
    if not url:
        return None
    return {
        "inline_keyboard": [
            [{"text": "Открыть Volnovoi Cult", "web_app": {"url": url}}],
        ]
    }


async def process_bot_start_message(db: Session, message: dict) -> bool:
    """Личка: /start → регистрация (если новый) и приветствие."""
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

    first_name = from_user.get("first_name")
    if isinstance(first_name, str):
        first_name = first_name.strip() or None
    else:
        first_name = None

    try:
        sub = register_subscriber_with_meta(
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

    keyboard = build_mini_app_keyboard()
    text = build_bot_welcome_text(
        first_name=first_name,
        has_app_button=keyboard is not None,
        trial_used=bool(sub.trial_used),
        has_active_sub=subscription_active(sub, is_admin=False),
    )
    try:
        await send_message(
            uid,
            text,
            parse_mode="HTML",
            reply_markup=keyboard,
        )
    except Exception:
        logger.exception("bot /start welcome send failed uid=%s", uid)
        return False

    logger.info("bot /start welcome uid=%s ref=%r", uid, start_param or None)
    return True
