"""Парсинг скрина Hash Hedge (проп) для ежедневной сверки трекера."""

from __future__ import annotations

import io
import re
from dataclasses import dataclass
from pathlib import Path

from app.hashhedge_rules import ACCOUNT_SIZES

_MONEY = re.compile(r"\$[\s\u00a0]*(\d[\d \u00a0,]*)")
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
    cleaned = re.sub(r"[\s\u00a0,]", "", raw)
    if not cleaned:
        return None
    try:
        return round(float(cleaned), 2)
    except ValueError:
        return None


_PNL_LABEL = re.compile(
    r"(?:Realize|Unrealize|реализ|P&L|прибыл|убыт|потеря|loss|profit|Заработать)",
    re.IGNORECASE,
)
_SPLIT_SUFFIX = re.compile(r"^[\s\n]+(\d{2,4})\b")


def _merge_split_ocr_amount(tail: str, match_end: int, value: float) -> float:
    """OCR часто рвёт $4 977 → «$4» + строка «977» или «$49» + «77»."""
    if value >= 500:
        return value
    rest = tail[match_end:]
    suffix = _SPLIT_SUFFIX.match(rest)
    if not suffix:
        return value
    merged = float(f"{int(value)}{suffix.group(1)}")
    return merged if merged > value else value


def _money_candidates_after_label(text: str, label: re.Pattern[str], *, window: int = 280) -> list[float]:
    match = label.search(text)
    if not match:
        return []
    tail = text[match.end() : match.end() + window]
    values: list[float] = []
    for money in _MONEY.finditer(tail):
        before = tail[max(0, money.start() - 24) : money.start()]
        if _PNL_LABEL.search(before):
            continue
        raw = _parse_money_token(money.group(1))
        if raw is None or raw <= 0:
            continue
        values.append(_merge_split_ocr_amount(tail, money.end(), raw))
    return values


def _plausible_balance(value: float, account_size: float | None) -> bool:
    if value < 100:
        return False
    if account_size is None:
        return value >= 500
    return account_size * 0.5 <= value <= account_size * 1.15


def _pick_balance(candidates: list[float], account_size: float | None) -> float | None:
    plausible = [v for v in candidates if _plausible_balance(v, account_size)]
    if not plausible:
        return None
    if account_size is not None:
        return max(plausible, key=lambda v: (-abs(account_size - v), v))
    return max(plausible)


def _resolve_balance(text: str, account_size: float | None) -> float | None:
    assets = _money_candidates_after_label(text, _ASSETS_LABEL)
    balance = _money_candidates_after_label(text, _BALANCE_LABEL)
    candidates = assets + balance
    picked = _pick_balance(candidates, account_size)
    if picked is not None:
        return picked
    if account_size is not None:
        return _pick_balance([v for v in candidates if v >= 100], account_size)
    return max(candidates) if candidates else None


def _account_size_from_plan(text: str) -> float | None:
    """Ищет размер счёта в 60 символах после названия тарифа.

    Работает для «STARTER - $5 000», «STARTER ^\n$5 000» и других форматов
    с любым разделителем между названием плана и суммой.
    """
    for m in _PLAN.finditer(text):
        window = text[m.start() : m.start() + 60]
        for money in _MONEY.finditer(window):
            raw = _parse_money_token(money.group(1))
            if raw is None or raw < 100:
                continue
            if raw < 500:
                rest = text[m.start() + money.end() :]
                suffix = _SPLIT_SUFFIX.match(rest)
                if suffix:
                    merged = float(f"{int(raw)}{suffix.group(1)}")
                    if merged > raw:
                        raw = merged
            nearest = min(ACCOUNT_SIZES, key=lambda s: abs(s - raw))
            if abs(nearest - raw) <= max(50.0, nearest * 0.02):
                return float(nearest)
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

    account_size = _account_size_from_plan(normalized)
    if account_size is None:
        account_size = _nearest_account_size(normalized, None)

    balance = _resolve_balance(normalized, account_size)
    if balance is None:
        raise PropScreenshotParseError("Не найден баланс на скрине (Баланс / Активы)")
    if account_size is None:
        account_size = _nearest_account_size(normalized, balance)

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
