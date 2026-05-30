"""Telegram Bot API helpers."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

API = "https://api.telegram.org/bot{token}/{method}"


def _api(method: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    token = settings.bot_token
    if not token:
        raise RuntimeError("BOT_TOKEN не задан")
    url = API.format(token=token, method=method)
    with httpx.Client(timeout=20.0) as client:
        r = client.post(url, json=payload or {})
        r.raise_for_status()
        data = r.json()
    if not data.get("ok"):
        desc = data.get("description", "telegram_error")
        raise RuntimeError(str(desc))
    return data


async def _api_async(method: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    token = settings.bot_token
    if not token:
        return {"ok": False, "description": "no_token"}
    url = API.format(token=token, method=method)
    async with httpx.AsyncClient(timeout=25.0) as client:
        r = await client.post(url, json=payload or {})
        r.raise_for_status()
        return r.json()


def get_chat(chat_id: str | int) -> dict[str, Any]:
    return _api("getChat", {"chat_id": chat_id})["result"]


async def get_updates(offset: int | None = None, timeout: int = 25) -> list[dict[str, Any]]:
    payload: dict[str, Any] = {"timeout": timeout, "allowed_updates": ["channel_post", "edited_channel_post"]}
    if offset is not None:
        payload["offset"] = offset
    data = await _api_async("getUpdates", payload)
    if not data.get("ok"):
        logger.warning("getUpdates failed: %s", data.get("description"))
        return []
    return data.get("result") or []
