"""Загрузка аватара пользователя через Telegram Bot API."""

from __future__ import annotations

import logging
from pathlib import Path

import httpx

from app.config import settings
from app.media_storage import save_avatar_bytes

logger = logging.getLogger(__name__)


def ensure_trader_avatar(telegram_id: int) -> str | None:
    """Скачивает аватар в /media/avatars/{id}.jpg если есть BOT_TOKEN. Возвращает относительный путь."""
    if not settings.bot_token:
        return None
    existing = Path(settings.media_root) / "avatars" / f"{telegram_id}.jpg"
    if existing.is_file():
        return f"avatars/{telegram_id}.jpg"

    try:
        data = _download_avatar_sync(telegram_id, settings.bot_token)
        if data:
            return save_avatar_bytes(telegram_id, data, ".jpg")
    except Exception as e:
        logger.warning("avatar fetch %s: %s", telegram_id, e)
    return None


def _download_avatar_sync(user_id: int, token: str) -> bytes | None:
    base = f"https://api.telegram.org/bot{token}"
    with httpx.Client(timeout=20.0) as client:
        r = client.get(f"{base}/getUserProfilePhotos", params={"user_id": user_id, "limit": 1})
        if r.status_code != 200:
            return None
        payload = r.json()
        if not payload.get("ok"):
            return None
        photos = payload.get("result", {}).get("photos") or []
        if not photos:
            return None
        sizes = photos[0]
        if not sizes:
            return None
        file_id = sizes[-1].get("file_id")
        if not file_id:
            return None
        fr = client.get(f"{base}/getFile", params={"file_id": file_id})
        if fr.status_code != 200 or not fr.json().get("ok"):
            return None
        file_path = fr.json()["result"]["file_path"]
        img = client.get(f"https://api.telegram.org/file/bot{token}/{file_path}")
        if img.status_code == 200:
            return img.content
    return None
