from io import BytesIO

from PIL import Image

from app.telegram_notify_screenshot import render_punk_notify_screenshot
from app.trader_quotes import TRADER_QUOTES, random_trader_quote


def _sample_png() -> bytes:
    img = Image.new("RGB", (400, 240), (30, 40, 55))
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_random_trader_quote_from_pool():
    q = random_trader_quote()
    assert q in TRADER_QUOTES


def test_render_punk_screenshot_produces_jpeg():
    out = render_punk_notify_screenshot(
        _sample_png(),
        quote="Рынок платит за терпение.",
        watermark="@TestVolnovoiBot",
    )
    assert out[:2] == b"\xff\xd8"
    img = Image.open(BytesIO(out))
    assert img.width > 400
    assert img.height > 240


def test_render_adds_footer_for_long_quote():
    long_q = " ".join(["слово"] * 30)
    out = render_punk_notify_screenshot(_sample_png(), quote=long_q, watermark="@bot")
    img = Image.open(BytesIO(out))
    assert img.height > 300
