"""Telegram Bot API helpers."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

API = "https://api.telegram.org/bot{token}/{method}"


class TelegramApiError(RuntimeError):
    """Telegram Bot API returned ok=false or non-2xx HTTP status."""

    def __init__(self, description: str, *, status_code: int | None = None) -> None:
        self.status_code = status_code
        super().__init__(description)


def _parse_response(r: httpx.Response) -> dict[str, Any]:
    try:
        data = r.json()
    except ValueError:
        data = {}
    if not r.is_success or not data.get("ok"):
        desc = str(data.get("description") or f"HTTP {r.status_code}")
        raise TelegramApiError(desc, status_code=r.status_code)
    return data


def _api(method: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    token = settings.bot_token
    if not token:
        raise RuntimeError("BOT_TOKEN не задан")
    url = API.format(token=token, method=method)
    with httpx.Client(timeout=20.0) as client:
        r = client.post(url, json=payload or {})
        return _parse_response(r)


async def _api_async(method: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    token = settings.bot_token
    if not token:
        return {"ok": False, "description": "no_token"}
    url = API.format(token=token, method=method)
    async with httpx.AsyncClient(timeout=25.0) as client:
        r = await client.post(url, json=payload or {})
        try:
            return _parse_response(r)
        except TelegramApiError as e:
            logger.warning("telegram %s failed: %s", method, e)
            return {"ok": False, "description": str(e)}


def delete_webhook() -> None:
    """Long polling не работает, пока активен webhook."""
    try:
        _api("deleteWebhook", {"drop_pending_updates": False})
        logger.info("telegram: webhook cleared for polling")
    except TelegramApiError as e:
        logger.warning("telegram deleteWebhook: %s", e)
    except httpx.HTTPError as e:
        logger.warning("telegram deleteWebhook http error: %s", e)


def get_chat(chat_id: str | int) -> dict[str, Any]:
    try:
        return _api("getChat", {"chat_id": chat_id})["result"]
    except TelegramApiError as e:
        msg = str(e).lower()
        if "chat not found" in msg:
            raise ValueError("Канал не найден. Проверьте ссылку и что канал публичный.") from e
        raise


def verify_bot_is_channel_admin(chat_id: int) -> None:
    try:
        me = _api("getMe")["result"]
        bot_id = int(me["id"])
        member = _api("getChatMember", {"chat_id": chat_id, "user_id": bot_id})["result"]
    except TelegramApiError as e:
        msg = str(e).lower()
        if any(x in msg for x in ("not found", "user_not_participant", "chat not found", "member")):
            raise ValueError(
                "Добавьте бота администратором канала (права на чтение постов)"
            ) from e
        raise
    if member.get("status") not in ("administrator", "creator"):
        raise ValueError("Добавьте бота администратором канала (права на чтение постов)")


async def get_updates(offset: int | None = None, timeout: int = 25) -> list[dict[str, Any]]:
    payload: dict[str, Any] = {
        "timeout": timeout,
        "allowed_updates": ["channel_post", "edited_channel_post"],
    }
    if offset is not None:
        payload["offset"] = offset

    token = settings.bot_token
    if not token:
        return []

    # Telegram держит соединение ~timeout сек — клиентский таймаут должен быть больше.
    client_timeout = max(35.0, float(timeout) + 15.0)
    url = API.format(token=token, method="getUpdates")

    try:
        async with httpx.AsyncClient(timeout=client_timeout) as client:
            r = await client.post(url, json=payload)
            data = _parse_response(r)
    except TelegramApiError as e:
        msg = str(e).lower()
        if "conflict" in msg:
            logger.error(
                "telegram getUpdates conflict: другой процесс или webhook использует того же бота"
            )
        else:
            logger.warning("telegram getUpdates failed: %s", e)
        return []
    except httpx.TimeoutException:
        # Ожидаемо при long poll — просто повторим на следующем цикле.
        return []
    except httpx.HTTPError as e:
        logger.warning("telegram getUpdates http error: %s", e)
        return []

    return data.get("result") or []
