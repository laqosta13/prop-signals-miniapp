"""Парсинг скрина Hash Hedge (проп) для ежедневной сверки трекера."""

from __future__ import annotations

import io
import re
from dataclasses import dataclass
from pathlib import Path

from app.hashhedge_rules import ACCOUNT_SIZES

_MONEY = re.compile(r"\$[\s\u00a0]*(\d[\d\s\u00a0,]*)")
_STAGE = re.compile(r"(?:Стадия|Stage)\s*(\d)", re.IGNORECASE)
_TRADING_DAYS = re.compile(
    r"(?:Торговые\s*дни|Trading\s*days?)[^\d]{0,40}(\d+)\s*/\s*(\d+)",
    re.IGNORECASE | re.DOTALL,
)
_PLAN = re.compile(
    r"\b(STARTER|STANDARD|ADVANCED|PRO|ELITE|PRIME)\b",
    re.IGNORECASE,
)
_BALANCE_LABEL = re.compile(r"(?:Баланс|Balance)\b", re.IGNORECASE)
_ASSETS_LABEL = re.compile(r"(?:Активы|Assets)\b", re.IGNORECASE)


@dataclass(frozen=True)
class PropScreenshotData:
    balance: float
    account_size: float | None = None
    stage: int | None = None
    trading_days: int | None = None
    trading_days_required: int | None = None


class PropScreenshotParseError(ValueError):
    pass


def _parse_money_token(raw: str) -> float | None:
    cleaned = raw.replace("\u00a0", " ").replace(" ", "").replace(",", "")
    if not cleaned:
        return None
    try:
        return round(float(cleaned), 2)
    except ValueError:
        return None


def _money_after_label(text: str, label: re.Pattern[str]) -> float | None:
    match = label.search(text)
    if not match:
        return None
    tail = text[match.end() : match.end() + 220]
    for money in _MONEY.finditer(tail):
        value = _parse_money_token(money.group(1))
        if value is not None and value > 0:
            return value
    return None


def _nearest_account_size(text: str, balance: float | None) -> float | None:
    sizes: list[float] = []
    for money in _MONEY.finditer(text):
        value = _parse_money_token(money.group(1))
        if value is None:
            continue
        nearest = min(ACCOUNT_SIZES, key=lambda s: abs(s - value))
        if abs(nearest - value) <= max(50.0, nearest * 0.02):
            sizes.append(float(nearest))
    if not sizes:
        return None
    if balance is not None:
        candidates = [s for s in sizes if s >= balance - 1.0]
        if candidates:
            return max(candidates)
    return max(sizes)


def parse_prop_ocr_text(text: str) -> PropScreenshotData:
    """Разбор текста OCR; покрыт unit-тестами без tesseract."""
    normalized = text.replace("\u00a0", " ").replace("\r", "\n")
    balance = _money_after_label(normalized, _BALANCE_LABEL)
    if balance is None:
        balance = _money_after_label(normalized, _ASSETS_LABEL)
    if balance is None:
        raise PropScreenshotParseError("Не найден баланс на скрине (Баланс / Активы)")

    stage = None
    stage_match = _STAGE.search(normalized)
    if stage_match:
        stage_n = int(stage_match.group(1))
        if 1 <= stage_n <= 3:
            stage = stage_n

    trading_days = None
    trading_days_required = None
    days_match = _TRADING_DAYS.search(normalized)
    if days_match:
        trading_days = int(days_match.group(1))
        trading_days_required = int(days_match.group(2))

    account_size = _nearest_account_size(normalized, balance)
    if account_size is None and _PLAN.search(normalized):
        account_size = _nearest_account_size(normalized, None)

    return PropScreenshotData(
        balance=balance,
        account_size=account_size,
        stage=stage,
        trading_days=trading_days,
        trading_days_required=trading_days_required,
    )


def parse_prop_screenshot_bytes(data: bytes) -> PropScreenshotData:
    try:
        from PIL import Image
    except ImportError as exc:
        raise PropScreenshotParseError("OCR недоступен (Pillow)") from exc

    try:
        import pytesseract
    except ImportError as exc:
        raise PropScreenshotParseError("OCR недоступен (pytesseract)") from exc

    img = Image.open(io.BytesIO(data))
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")

    errors: list[str] = []
    for lang in ("rus+eng", "eng", "rus"):
        try:
            text = pytesseract.image_to_string(img, lang=lang)
            return parse_prop_ocr_text(text)
        except PropScreenshotParseError as exc:
            errors.append(str(exc))
        except Exception as exc:
            errors.append(str(exc))

    detail = errors[0] if errors else "не удалось распознать скрин"
    raise PropScreenshotParseError(detail)


def parse_prop_screenshot_path(path: str | Path) -> PropScreenshotData:
    return parse_prop_screenshot_bytes(Path(path).read_bytes())
