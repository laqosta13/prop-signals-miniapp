"""Реферальные ссылки Mini App (?startapp=CODE)."""

from __future__ import annotations

import logging
from urllib.parse import quote

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_cached_bot_username: str | None = None


def telegram_bot_username() -> str:
    global _cached_bot_username
    manual = (settings.telegram_bot_username or "").strip().lstrip("@")
    if manual:
        return manual
    if _cached_bot_username:
        return _cached_bot_username
    token = settings.bot_token.strip()
    if not token:
        return ""
    try:
        with httpx.Client(timeout=settings.price_http_timeout_seconds) as client:
            r = client.get(f"https://api.telegram.org/bot{token}/getMe")
            if r.status_code == 200:
                data = r.json()
                if data.get("ok") and data.get("result", {}).get("username"):
                    _cached_bot_username = str(data["result"]["username"])
                    return _cached_bot_username
    except Exception as e:
        logger.warning("getMe for bot username failed: %s", e)
    return ""


def build_referral_link(code: str) -> str:
    code = (code or "").strip().upper()
    if not code:
        return ""
    user = telegram_bot_username()
    if not user:
        return ""
    return f"https://t.me/{user}?startapp={quote(code, safe='')}"


def referral_share_text(*, bonus_days: int) -> str:
    return (
        f"PROP-DESK · сигналы и трекер Hash Hedge. "
        f"Попробуй бесплатно — по моей ссылке, а мне начислят +{bonus_days} дн. подписки."
    )
