from app.coin_icons import symbol_base


def test_symbol_base_strips_quote_and_multiplier():
    assert symbol_base("BTCUSDT") == "BTC"
    assert symbol_base("1000PEPEUSDT") == "PEPE"
    assert symbol_base("tonusdt") == "TON"
