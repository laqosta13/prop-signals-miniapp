from types import SimpleNamespace

from app.price_service import PriceQuote, monitor_outcome_for_signal


def _signal(**kwargs):
    defaults = {
        "status": "active",
        "direction": "long",
        "entry_low": "67.72",
        "entry_high": "67.72",
        "entry_filled_at": "2026-06-01T00:00:00+00:00",
        "stop_loss": "67.0032",
        "take_profits": "69.71",
        "published_market_price": 67.72,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_in_trade_closes_when_price_past_stop():
    signal = _signal()
    quotes = [PriceQuote("bybit_perp", 66.99)]
    hit = monitor_outcome_for_signal(signal, quotes)
    assert hit is not None
    assert hit[0] == "lose"
    assert hit[1].price == 66.99


def test_in_trade_stays_open_above_stop():
    signal = _signal()
    quotes = [PriceQuote("bybit_perp", 67.23)]
    assert monitor_outcome_for_signal(signal, quotes) is None


def test_before_entry_closes_when_price_past_stop():
    signal = _signal(entry_filled_at=None, entry_low="68.0", entry_high="68.5")
    quotes = [PriceQuote("bybit_perp", 67.0)]
    hit = monitor_outcome_for_signal(signal, quotes)
    assert hit is not None
    assert hit[0] == "lose"
