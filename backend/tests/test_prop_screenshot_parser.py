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
