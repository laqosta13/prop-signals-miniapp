"""Панк-оформление скринов в Telegram push: рамка, водяной знак, цитата."""

from __future__ import annotations

import io
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from app.referral_links import telegram_bot_username
from app.trader_quotes import random_trader_quote

# CP2077 / punk palette (theme.css)
_BG = (10, 10, 12)
_BORDER = (0, 240, 255)
_BORDER_INNER = (255, 42, 109)
_FOOTER_BG = (7, 8, 13)
_TEXT = (252, 238, 10)
_MUTED = (0, 240, 255)
_WATERMARK = (0, 240, 255, 38)

_MAX_WIDTH = 960
_FRAME_PAD = 14
_BORDER_W = 3
_FOOTER_PAD_Y = 12
_QUOTE_FONT_SIZE = 17
_WATERMARK_FONT_SIZE = 26

_FONT_CANDIDATES = (
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
)


def _load_font(size: int, *, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    paths = (
        ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",)
        if bold
        else _FONT_CANDIDATES
    )
    for path in paths:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def _wrap_lines(text: str, font: ImageFont.ImageFont, max_width: int) -> list[str]:
    words = text.split()
    if not words:
        return []
    lines: list[str] = []
    current = words[0]
    for word in words[1:]:
        trial = f"{current} {word}"
        if font.getlength(trial) <= max_width:
            current = trial
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def _scale_to_width(img: Image.Image, max_width: int) -> Image.Image:
    if img.width <= max_width:
        return img
    ratio = max_width / img.width
    new_h = max(1, int(img.height * ratio))
    return img.resize((max_width, new_h), Image.Resampling.LANCZOS)


def _watermark_label() -> str:
    user = telegram_bot_username()
    if user:
        return f"@{user.lstrip('@')}"
    return "@VolnovoiCult"


def _draw_watermark(layer: Image.Image, label: str) -> None:
    overlay = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    font = _load_font(_WATERMARK_FONT_SIZE, bold=True)
    w, h = layer.size
    step_x = int(font.getlength(label) + 80)
    step_y = 110
    for y in range(-h, h * 2, step_y):
        offset = (y // step_y % 2) * (step_x // 2)
        for x in range(-w, w * 2, step_x):
            draw.text((x + offset, y), label, font=font, fill=_WATERMARK)
    rotated = overlay.rotate(-24, resample=Image.Resampling.BICUBIC, expand=False)
    layer.alpha_composite(rotated)


def _draw_scanlines(layer: Image.Image) -> None:
    draw = ImageDraw.Draw(layer)
    w, h = layer.size
    for y in range(0, h, 4):
        draw.line([(0, y), (w, y)], fill=(0, 240, 255, 10), width=1)


def _footer_height(quote: str, inner_w: int) -> int:
    font = _load_font(_QUOTE_FONT_SIZE)
    lines = _wrap_lines(f"«{quote}»", font, inner_w - 20)
    ascent, descent = font.getmetrics()
    line_h = ascent + descent + 3
    return _FOOTER_PAD_Y * 2 + len(lines) * line_h + 8


def render_punk_notify_screenshot(
    raw: bytes,
    *,
    quote: str | None = None,
    watermark: str | None = None,
) -> bytes:
    """Рамка в стиле punk, водяной знак бота, цитата трейдера внизу."""
    quote_text = (quote or random_trader_quote()).strip()
    mark = (watermark or _watermark_label()).strip()

    src = Image.open(io.BytesIO(raw))
    if src.mode not in ("RGB", "RGBA"):
        src = src.convert("RGBA")
    else:
        src = src.convert("RGBA")

    shot = _scale_to_width(src, _MAX_WIDTH - _FRAME_PAD * 2 - _BORDER_W * 2)
    inner_w = shot.width
    footer_h = _footer_height(quote_text, inner_w)
    total_w = inner_w + (_FRAME_PAD + _BORDER_W) * 2
    total_h = shot.height + (_FRAME_PAD + _BORDER_W) * 2 + footer_h

    canvas = Image.new("RGBA", (total_w, total_h), _BG + (255,))
    draw = ImageDraw.Draw(canvas)

    # Внешняя неоновая рамка
    draw.rectangle((0, 0, total_w - 1, total_h - 1), outline=_BORDER, width=_BORDER_W)
    ix0 = _FRAME_PAD
    iy0 = _FRAME_PAD
    ix1 = total_w - _FRAME_PAD - 1
    iy1 = total_h - _FRAME_PAD - footer_h - 1
    draw.rectangle((ix0, iy0, ix1, iy1), outline=_BORDER_INNER, width=1)

    shot_x = _FRAME_PAD + _BORDER_W
    shot_y = _FRAME_PAD + _BORDER_W
    canvas.paste(shot, (shot_x, shot_y), shot)
    shot_layer = canvas.crop((shot_x, shot_y, shot_x + shot.width, shot_y + shot.height))
    _draw_watermark(shot_layer, mark)
    _draw_scanlines(shot_layer)
    canvas.paste(shot_layer, (shot_x, shot_y))

    # Подпись цитаты под скрином
    fy0 = total_h - _FRAME_PAD - footer_h
    draw.rectangle(
        (_FRAME_PAD, fy0, total_w - _FRAME_PAD - 1, total_h - _FRAME_PAD - 1),
        fill=_FOOTER_BG + (255,),
    )
    draw.line(
        [(_FRAME_PAD, fy0), (total_w - _FRAME_PAD, fy0)],
        fill=_BORDER,
        width=2,
    )

    quote_font = _load_font(_QUOTE_FONT_SIZE)
    meta_font = _load_font(13)
    lines = _wrap_lines(f"«{quote_text}»", quote_font, inner_w - 24)
    ty = fy0 + _FOOTER_PAD_Y
    for line in lines:
        draw.text((_FRAME_PAD + 12, ty), line, fill=_TEXT, font=quote_font)
        ascent, descent = quote_font.getmetrics()
        ty += ascent + descent + 3
    draw.text(
        (_FRAME_PAD + 12, total_h - _FRAME_PAD - 18),
        "— Volnovoi Cult",
        fill=_MUTED,
        font=meta_font,
    )

    out = canvas.convert("RGB")
    buf = io.BytesIO()
    out.save(buf, format="JPEG", quality=90, optimize=True)
    return buf.getvalue()


def render_punk_notify_screenshot_path(
    path: Path,
    *,
    quote: str | None = None,
    watermark: str | None = None,
) -> bytes:
    return render_punk_notify_screenshot(path.read_bytes(), quote=quote, watermark=watermark)
