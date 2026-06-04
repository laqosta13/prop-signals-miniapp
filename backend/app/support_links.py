"""Ссылки на поддержку в Telegram."""

from __future__ import annotations

from app.config import settings
from app.referral_links import telegram_bot_username


def telegram_support_username() -> str:
    manual = (settings.telegram_support_username or "").strip().lstrip("@")
    if manual:
        return manual
    return telegram_bot_username()


def build_support_url() -> str:
    user = telegram_support_username()
    if not user:
        return ""
    return f"https://t.me/{user}"
