"""Глобальный тестовый период: всё бесплатно до дедлайна, после — только по подписке."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.config import settings

TEST_MODE_DAYS_DEFAULT = 30


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_start_at(raw: str) -> datetime | None:
    text = raw.strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = f"{text[:-1]}+00:00"
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def test_mode_start_at() -> datetime | None:
    return _parse_start_at(settings.test_mode_start_at)


def test_mode_until() -> datetime | None:
    start = test_mode_start_at()
    if start is None:
        return None
    days = max(1, int(settings.test_mode_days or TEST_MODE_DAYS_DEFAULT))
    return start + timedelta(days=days)


def is_test_mode_active() -> bool:
    until = test_mode_until()
    if until is None:
        return False
    return _now() < until


def test_mode_days_left() -> int:
    until = test_mode_until()
    if until is None:
        return 0
    delta = until - _now()
    if delta.total_seconds() <= 0:
        return 0
    days = delta.days
    if delta.seconds > 0 or delta.microseconds > 0:
        days += 1
    return max(0, days)


def test_mode_public_fields() -> dict:
    active = is_test_mode_active()
    until = test_mode_until()
    return {
        "test_mode_active": active,
        "test_mode_until": until if active else None,
        "test_mode_days_left": test_mode_days_left() if active else 0,
    }
