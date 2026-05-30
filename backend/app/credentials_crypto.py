"""Шифрование API-ключей пользователей (Fernet, ключ из BOT_TOKEN / EXCHANGE_SECRETS_KEY)."""

from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings

_fernet: Fernet | None = None


def _fernet_key() -> bytes:
    raw = (settings.exchange_secrets_key or settings.bot_token or "").strip()
    if not raw:
        raise RuntimeError("BOT_TOKEN or EXCHANGE_SECRETS_KEY required for API key storage")
    return base64.urlsafe_b64encode(hashlib.sha256(raw.encode()).digest())


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        _fernet = Fernet(_fernet_key())
    return _fernet


def encrypt_secret(plain: str) -> str:
    return _get_fernet().encrypt(plain.encode()).decode()


def decrypt_secret(cipher: str) -> str:
    try:
        return _get_fernet().decrypt(cipher.encode()).decode()
    except InvalidToken as e:
        raise ValueError("decrypt_failed") from e
