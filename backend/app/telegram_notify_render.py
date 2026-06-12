"""PNG-карточки push-уведомлений с цветом по направлению (LONG/SHORT)."""

from __future__ import annotations

import io
import re
from typing import Iterable

from PIL import Image, ImageDraw, ImageFont

_TAG_RE = re.compile(r"<[^>]+>")

# Punk / CP2077 (theme.css)
_LONG_FILL = (8, 28, 24)
_LONG_ACCENT = (5, 255, 161)
_SHORT_FILL = (36, 8, 18)
_SHORT_ACCENT = (255, 42, 109)
_CANVAS = (7, 8, 13)
_TEXT = (252, 238, 10)
_MUTED = (0, 240, 255)
_BORDER_GLOW = (0, 240, 255)

_FONT_CANDIDATES = (
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
)


def _load_font(size: int, *, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    paths = _FONT_CANDIDATES if not bold else (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        *_FONT_CANDIDATES,
    )
    for path in paths:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def _plain(html: str) -> str:
    text = _TAG_RE.sub("", html)
    return text.replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&").replace("&quot;", '"')


def _parse_blockquotes(html_text: str) -> tuple[str, list[str], str]:
    open_tag = "<blockquote>"
    close_tag = "</blockquote>"
    banner_parts: list[str] = []
    blocks: list[str] = []
    tail_parts: list[str] = []
    i = 0
    seen = False
    while True:
        start = html_text.find(open_tag, i)
        if start == -1:
            chunk = html_text[i:]
            (banner_parts if not seen else tail_parts).append(chunk)
            break
        before = html_text[i:start]
        (banner_parts if not seen else tail_parts).append(before)
        seen = True
        end = html_text.find(close_tag, start)
        if end == -1:
            break
        blocks.append(html_text[start + len(open_tag) : end])
        i = end + len(close_tag)
    banner = _plain("".join(banner_parts)).strip()
    tail = _plain("".join(tail_parts)).strip()
    return banner, [_plain(b).strip() for b in blocks if b.strip()], tail


def _wrap_lines(text: str, font: ImageFont.ImageFont, max_width: int) -> list[str]:
    lines: list[str] = []
    for paragraph in text.split("\n"):
        paragraph = paragraph.strip()
        if not paragraph:
            lines.append("")
            continue
        words = paragraph.split()
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


def _block_height(lines: Iterable[str], font: ImageFont.ImageFont, line_gap: int) -> int:
    lines = list(lines)
    if not lines:
        return 0
    ascent, descent = font.getmetrics()
    return len(lines) * (ascent + descent + line_gap) - line_gap


def _direction_palette(direction: str) -> tuple[tuple[int, int, int], tuple[int, int, int]]:
    if (direction or "").lower() == "short":
        return _SHORT_FILL, _SHORT_ACCENT
    return _LONG_FILL, _LONG_ACCENT


def render_notify_card_png(html_text: str, *, direction: str) -> bytes | None:
    """Рендер карточки. None — если в тексте нет blockquote (например, новости)."""
    banner, blocks, tail = _parse_blockquotes(html_text)
    if not blocks:
        return None

    fill, accent = _direction_palette(direction)
    width = 640
    pad_x = 18
    pad_y = 14
    gap = 10
    inner_w = width - pad_x * 2 - 8
    banner_font = _load_font(22, bold=True)
    body_font = _load_font(17)
    line_gap = 4

    banner_lines = _wrap_lines(banner, banner_font, inner_w) if banner else []
    block_line_sets = [_wrap_lines(block, body_font, inner_w) for block in blocks]
    tail_lines = _wrap_lines(tail, body_font, inner_w) if tail else []

    height = pad_y
    if banner_lines:
        height += _block_height(banner_lines, banner_font, line_gap) + gap
    for lines in block_line_sets:
        height += pad_y * 2 + _block_height(lines, body_font, line_gap) + gap
    if tail_lines:
        height += _block_height(tail_lines, body_font, line_gap)
    height += pad_y

    img = Image.new("RGB", (width, max(height, 80)), _CANVAS)
    draw = ImageDraw.Draw(img)
    draw.rectangle((0, 0, width - 1, max(height, 80) - 1), outline=_BORDER_GLOW, width=2)
    y = pad_y

    if banner_lines:
        for line in banner_lines:
            draw.text((pad_x, y), line, fill=_TEXT, font=banner_font)
            ascent, descent = banner_font.getmetrics()
            y += ascent + descent + line_gap
        y += gap

    for lines in block_line_sets:
        block_h = pad_y * 2 + _block_height(lines, body_font, line_gap)
        x0 = pad_x
        x1 = width - pad_x
        y0 = y
        y1 = y + block_h
        draw.rounded_rectangle((x0, y0, x1, y1), radius=12, fill=fill)
        draw.rectangle((x0, y0, x0 + 5, y1), fill=accent)
        ty = y0 + pad_y
        for line in lines:
            draw.text((x0 + 14, ty), line, fill=_TEXT, font=body_font)
            ascent, descent = body_font.getmetrics()
            ty += ascent + descent + line_gap
        y = y1 + gap

    if tail_lines:
        for line in tail_lines:
            draw.text((pad_x, y), line, fill=_MUTED, font=body_font)
            ascent, descent = body_font.getmetrics()
            y += ascent + descent + line_gap

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()
