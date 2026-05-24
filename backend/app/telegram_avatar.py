"""Загрузка аватара: photo_url из Mini App или Telegram Bot API."""

from __future__ import annotations

import logging
from pathlib import Path

import httpx

from app.config import settings
from app.media_storage import media_root, save_avatar_bytes

logger = logging.getLogger(__name__)


def _avatar_rel(telegram_id: int) -> str:
    return f"avatars/{telegram_id}.jpg"


def _avatar_file(telegram_id: int) -> Path:
    return media_root() / "avatars" / f"{telegram_id}.jpg"


def _download_bytes(url: str) -> bytes | None:
    try:
        with httpx.Client(timeout=20.0, follow_redirects=True) as client:
            r = client.get(url)
            if r.status_code == 200 and r.content:
                return r.content
            logger.warning("avatar URL HTTP %s len=%s", r.status_code, len(r.content or b""))
    except Exception as e:
        logger.warning("avatar URL fetch failed: %s", e)
    return None


def _download_via_bot_api(user_id: int, token: str) -> bytes | None:
    base = f"https://api.telegram.org/bot{token}"
    try:
        with httpx.Client(timeout=20.0) as client:
            r = client.get(f"{base}/getUserProfilePhotos", params={"user_id": user_id, "limit": 1})
            if r.status_code != 200:
                logger.warning("getUserProfilePhotos HTTP %s user=%s", r.status_code, user_id)
                return None
            payload = r.json()
            if not payload.get("ok"):
                logger.warning("getUserProfilePhotos not ok user=%s: %s", user_id, payload.get("description"))
                return None
            photos = payload.get("result", {}).get("photos") or []
            if not photos or not photos[0]:
                logger.info("no profile photos for user=%s", user_id)
                return None
            file_id = photos[0][-1].get("file_id")
            if not file_id:
                return None
            fr = client.get(f"{base}/getFile", params={"file_id": file_id})
            if fr.status_code != 200 or not fr.json().get("ok"):
                return None
            file_path = fr.json()["result"]["file_path"]
            img = client.get(f"https://api.telegram.org/file/bot{token}/{file_path}")
            if img.status_code == 200 and img.content:
                return img.content
    except Exception as e:
        logger.warning("bot avatar fetch user=%s: %s", user_id, e)
    return None


def ensure_trader_avatar(telegram_id: int, photo_url: str | None = None) -> str | None:
    """Скачивает аватар на диск. Возвращает относительный путь avatars/{id}.jpg."""
    existing = _avatar_file(telegram_id)
    if existing.is_file() and existing.stat().st_size > 0:
        return _avatar_rel(telegram_id)

    data: bytes | None = None
    if photo_url:
        data = _download_bytes(photo_url)
        if data:
            logger.info("avatar from photo_url user=%s", telegram_id)

    if not data and settings.bot_token:
        data = _download_via_bot_api(telegram_id, settings.bot_token)
        if data:
            logger.info("avatar from bot API user=%s", telegram_id)

    if not data:
        if not settings.bot_token and not photo_url:
            logger.debug("avatar skip user=%s: no BOT_TOKEN and no photo_url", telegram_id)
        return None

    try:
        return save_avatar_bytes(telegram_id, data, ".jpg")
    except Exception as e:
        logger.warning("avatar save user=%s: %s", telegram_id, e)
        return None
