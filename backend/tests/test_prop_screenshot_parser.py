import pytest

from app.prop_screenshot_parser import PropScreenshotParseError, parse_prop_ocr_text


SAMPLE_OCR = """
Челлендж · Стадия 1
STARTER
$5 000
Задачи
Заработать
$0 / $400
Торговые дни
1 / 5
Риски
Дневная потеря
$15.54 / $250
Статистика
Активы
$4 984
Unrealize P&L $0
Баланс
$4 984
Realize P&L -$16
"""


def test_parse_hashhedge_sample():
    data = parse_prop_ocr_text(SAMPLE_OCR)
    assert data.balance == 4984.0
    assert data.account_size == 5000.0
    assert data.stage == 1
    assert data.trading_days == 1
    assert data.trading_days_required == 5


def test_parse_requires_balance():
    with pytest.raises(PropScreenshotParseError):
        parse_prop_ocr_text("STARTER $5 000 Стадия 1")


def test_parse_split_balance_ocr_lines():
    """OCR рвёт $4 977 на «$49» и строку «77»."""
    text = """
STARTER $5 000 Стадия 1
Статистика
Активы
$4 977
Баланс
$49
77
Realize P&L -$23
"""
    data = parse_prop_ocr_text(text)
    assert data.balance == 4977.0
    assert data.account_size == 5000.0


def test_parse_prefers_assets_when_balance_fragmented():
    text = """
STARTER $5,000 Стадия 1
Активы $4,977
Баланс $49
"""
    data = parse_prop_ocr_text(text)
    assert data.balance == 4977.0


def test_parse_ignores_pnl_amounts_near_balance():
    text = """
STARTER $5 000 Стадия 1
Баланс
$49
77
Realize P&L $23
"""
    data = parse_prop_ocr_text(text)
    assert data.balance == 4977.0
