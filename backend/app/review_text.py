"""Проверка текста отзыва: без ссылок и контактов."""

from __future__ import annotations

import re

REVIEW_TEXT_FORBIDDEN_MSG = (
    "В отзыве нельзя указывать ссылки, @логины, почту и другие контакты."
)

_SCHEME = re.compile(r"(?:https?|ftp|tg)://", re.I)
_WWW = re.compile(r"\bwww\.", re.I)
_TG_LINK = re.compile(r"\b(?:t\.me|telegram\.me|telegram\.dog)/", re.I)
_DOMAIN = re.compile(
    r"(?<![@\w])"
    r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?"
    r"\.(?:com|ru|org|net|io|xyz|app|me|link|site|online|pro|info|biz|co|uk|de|fr|cc|tv|ws|su|by|ua|kz)"
    r"(?:/|\b|:)",
    re.I,
)
_EMAIL = re.compile(r"[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}", re.I)
_AT_HANDLE = re.compile(r"(?<!\w)@[a-zA-Z][a-zA-Z0-9_]{3,31}\b")


def review_text_error(text: str) -> str | None:
    s = text.strip()
    if not s:
        return None
    if _SCHEME.search(s) or _WWW.search(s) or _TG_LINK.search(s) or _DOMAIN.search(s):
        return REVIEW_TEXT_FORBIDDEN_MSG
    if _EMAIL.search(s) or _AT_HANDLE.search(s):
        return REVIEW_TEXT_FORBIDDEN_MSG
    return None
