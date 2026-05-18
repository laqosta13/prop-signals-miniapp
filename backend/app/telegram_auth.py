"""Проверка подписи Telegram Web App initData (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)."""

from __future__ import annotations

import hashlib
import hmac
import json
import urllib.parse
from dataclasses import dataclass
from typing import Any

from app.config import settings


@dataclass
class WebAppUser:
    id: int
    username: str | None = None
    start_param: str | None = None


def _parse_user(user_json: str) -> WebAppUser | None:
    try:
        data: dict[str, Any] = json.loads(user_json)
        uid = data.get("id")
        if uid is None:
            return None
        return WebAppUser(id=int(uid), username=data.get("username"))
    except (json.JSONDecodeError, TypeError, ValueError):
        return None


def validate_init_data(init_data: str, bot_token: str) -> WebAppUser | None:
    if not init_data or not bot_token:
        return None
    parsed = dict(urllib.parse.parse_qsl(init_data, strict_parsing=True))
    received_hash = parsed.pop("hash", None)
    if not received_hash:
        return None
    data_check_parts = [f"{k}={v}" for k, v in sorted(parsed.items())]
    data_check_string = "\n".join(data_check_parts)
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    calculated = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(calculated, received_hash):
        return None
    user_raw = parsed.get("user")
    if not user_raw:
        return None
    user = _parse_user(user_raw)
    if user is None:
        return None
    sp = parsed.get("start_param") or parsed.get("startattach") or ""
    if isinstance(sp, str) and sp.strip():
        user.start_param = sp.strip()[:128]
    return user
