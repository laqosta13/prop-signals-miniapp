from types import SimpleNamespace

from app.telegram_notify import format_entry_filled_message, format_new_signal_message


def _signal(**kwargs):
    defaults = {
        "id": 1,
        "number": 1,
        "symbol": "SOL",
        "direction": "long",
        "entry_low": None,
        "entry_high": None,
        "stop_loss": "67.0032",
        "take_profits": "69.71",
        "published_market_price": 67.72,
        "published_market_source": "bybit_perp",
        "leverage": 1,
        "risk_percent": 20.0,
        "tracker_balance": 10000.0,
        "account_size": 10000.0,
        "author_username": "volnovoi",
        "author_telegram_id": 1,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_new_signal_market_entry_shows_price_in_levels_block():
    msg = format_new_signal_message(_signal())
    assert "67.72" in msg
    assert "по рынку" in msg
    assert "Bybit perp" in msg
    assert "При посте" not in msg


def test_new_signal_limit_entry_keeps_zone():
    msg = format_new_signal_message(_signal(entry_low="67.5", entry_high="67.8", published_market_price=None))
    assert "67.5" in msg
    assert "67.8" in msg
    assert "по рынку" not in msg


def test_entry_filled_market_uses_market_status():
    msg = format_entry_filled_message(_signal())
    assert "по рынку" in msg
    assert "Лимитка" not in msg
    assert "67.72" in msg


def test_entry_filled_limit_uses_limit_status():
    msg = format_entry_filled_message(_signal(entry_low="67.72", entry_high="67.72"))
    assert "Лимитка" in msg
    assert "сработала" in msg
