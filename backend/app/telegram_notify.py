from __future__ import annotations

import asyncio
import html
import logging
import re
from dataclasses import dataclass
from pathlib import Path

from app.config import settings
from app.telegram_bot_api import (
    TelegramApiError,
    send_message,
    send_photo,
    send_photo_bytes,
)
from app.telegram_notify_render import render_notify_card_png
from app.media_storage import media_root
from app.models import NewsPost, Signal
from app.signal_utils import entry_zone_defined, format_signal_entry_display, parse_take_profit_levels
from app.trader_stats import (
    signal_entry_stake_pct,
    signal_entry_stake_usd,
    signal_leverage,
    closed_signal_move_pct,
    signal_pnl_base_usd,
    signal_realized_pnl_for_read,
    signal_tracker_balance,
)

logger = logging.getLogger(__name__)

_TAG_RE = re.compile(r"<[^>]+>")


def _esc(value: object | None) -> str:
    if value is None or value == "":
        return "—"
    return html.escape(str(value))


def _val(text: str) -> str:
    """Числа и уровни без <code> — в клиенте Telegram у code часто подчёркивание."""
    return _esc(text)


def _format_take_profits(raw: str | None) -> str:
    levels = parse_take_profit_levels(raw)
    if not levels:
        return "—"
    return ", ".join(_esc(f"{x:g}") for x in levels)


def _entry_label(entry_low: str | None, entry_high: str | None) -> str:
    low, high = entry_low, entry_high
    if low and high and low != high:
        return f"{_val(low)} – {_val(high)}"
    val = low or high
    return _val(val) if val else "—"


def _direction_badge(direction: str) -> str:
    d = (direction or "").lower()
    if d == "long":
        return "🟢 <b>LONG</b>"
    if d == "short":
        return "🔴 <b>SHORT</b>"
    return f"<b>{_esc(direction.upper())}</b>"


def _signal_headline(signal: Signal) -> str:
    num = signal.number if signal.number is not None else signal.id
    return (
        f"\n<blockquote>"
        f"<b>#{num}</b> · <b>{_esc(signal.symbol)}</b> · {_direction_badge(signal.direction)}"
        f"</blockquote>"
    )


def _section(title: str) -> str:
    return f"\n<i>{title}</i>"


def _row(label: str, value: str) -> str:
    return f"\n▸ {_esc(label)}  {value}"


def _highlight_block(title: str, body: str) -> str:
    """Визуально выделенный блок (как шапка сигнала) — для цен и итогов."""
    return f"\n<blockquote><i>{_esc(title)}</i>{body}</blockquote>"


def _bold_price(value: str) -> str:
    if not value or value == "—":
        return "—"
    return f"<b>{value}</b>"


def _entry_row_value(signal: Signal) -> str:
    display = format_signal_entry_display(
        signal.entry_low,
        signal.entry_high,
        signal.published_market_price,
    )
    if display == "—":
        return "—"
    price_part = _bold_price(_val(display))
    if not entry_zone_defined(signal.entry_low, signal.entry_high):
        tags = ["<i>по рынку</i>"]
        src = _market_source_label(signal.published_market_source)
        if src:
            tags.append(f"<i>{_esc(src)}</i>")
        return f"{price_part} · {' · '.join(tags)}"
    return price_part


def _levels_block(signal: Signal) -> str:
    body = _row("Вход", _entry_row_value(signal))
    body += _row("Стоп", _bold_price(_esc(signal.stop_loss) if signal.stop_loss else "—"))
    body += _row("Цель", _bold_price(_format_take_profits(signal.take_profits)))
    return _highlight_block("Уровни", body)


def _position_block(signal: Signal) -> str:
    stake = signal_entry_stake_pct(signal)
    stake_usd = signal_entry_stake_usd(signal)
    tracker = signal_tracker_balance(signal)
    lev = signal_leverage(signal)
    body = _row("Сумма", f"<b>{stake}%</b> × <b>{lev}x</b> · {_val(f'${stake_usd:,.0f}')}")
    body += _row("Трекер", _val(f"${tracker:,.0f}"))
    return _highlight_block("Позиция", body)


def _author_block(signal: Signal) -> str:
    return _highlight_block("Трейдер", _row("Автор", f"<b>{_esc(_signal_author_label(signal))}</b>"))


@dataclass
class SignalSnapshot:
    symbol: str
    direction: str
    entry_low: str | None
    entry_high: str | None
    stop_loss: str | None
    take_profits: str | None
    comment: str | None
    leverage: int | None
    risk_percent: float | None
    has_image: bool
    has_video: bool


def snapshot_signal(signal: Signal) -> SignalSnapshot:
    return SignalSnapshot(
        symbol=signal.symbol,
        direction=signal.direction,
        entry_low=signal.entry_low,
        entry_high=signal.entry_high,
        stop_loss=signal.stop_loss,
        take_profits=signal.take_profits,
        comment=signal.comment,
        leverage=signal.leverage,
        risk_percent=signal.risk_percent,
        has_image=bool(signal.media_image_path),
        has_video=bool(signal.media_video_path),
    )


def diff_signal_changes(
    before: SignalSnapshot,
    after: Signal,
    *,
    image_added: bool = False,
    image_removed: bool = False,
    video_added: bool = False,
    video_removed: bool = False,
) -> list[str]:
    lines: list[str] = []
    after_snap = snapshot_signal(after)

    def _cmp(label: str, old: object | None, new: object | None, fmt=_esc) -> None:
        o, n = fmt(old), fmt(new)
        if o != n:
            lines.append(f"▸ {_esc(label)}  {o} → {n}")

    _cmp("Тикер", before.symbol, after_snap.symbol)
    if before.direction != after_snap.direction:
        lines.append(
            f"▸ Направление  {_direction_badge(before.direction)} → {_direction_badge(after_snap.direction)}"
        )

    before_entry = _entry_label(before.entry_low, before.entry_high)
    after_entry = _entry_label(after_snap.entry_low, after_snap.entry_high)
    if before_entry != after_entry:
        lines.append(f"▸ Вход  {before_entry} → {after_entry}")

    _cmp("Стоп", before.stop_loss, after_snap.stop_loss)
    _cmp("Цель", _format_take_profits(before.take_profits), _format_take_profits(after_snap.take_profits), fmt=str)
    _cmp("Плечо", before.leverage, after_snap.leverage)
    if before.risk_percent != after_snap.risk_percent:
        lines.append(f"▸ Сумма %  {_val(str(before.risk_percent))} → {_val(str(after_snap.risk_percent))}")
    if (before.comment or "") != (after_snap.comment or ""):
        lines.append("▸ Комментарий  обновлён")

    if image_removed:
        lines.append("▸ <b>Медиа</b>  скрин убран")
    elif image_added:
        lines.append("▸ <b>Медиа</b>  + скрин")
    if video_removed:
        lines.append("▸ <b>Медиа</b>  видео убрано")
    elif video_added:
        lines.append("▸ <b>Медиа</b>  + видео")

    return lines


def format_actor_label(
    *,
    display_name: str | None = None,
    username: str | None = None,
    telegram_id: int | None = None,
) -> str:
    """Человекочитаемое имя автора действия (дополнение / правка / удаление)."""
    login = (username or "").strip().lstrip("@")
    name = (display_name or "").strip()
    if name and login:
        return name
    if name:
        return name
    if login:
        return login
    if telegram_id is not None:
        return f"id {telegram_id}"
    return "—"


def _signal_author_label(signal: Signal) -> str:
    return format_actor_label(username=signal.author_username, telegram_id=signal.author_telegram_id)


def _market_source_label(source: str | None) -> str:
    if not source:
        return ""
    labels = {
        "binance_spot": "Binance spot",
        "binance_perp": "Binance perp",
        "bybit_spot": "Bybit spot",
        "bybit_perp": "Bybit perp",
        "bingx_spot": "BingX spot",
        "bingx_perp": "BingX perp",
    }
    return labels.get(source, source)


def _signal_body(signal: Signal) -> str:
    return _levels_block(signal) + _position_block(signal) + _author_block(signal)


def _plain_fallback(text: str) -> str:
    return _TAG_RE.sub("", text).replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")


async def _send_message(chat_id: int, text: str) -> bool:
    if not settings.bot_token:
        logger.warning("BOT_TOKEN не задан — уведомление не отправлено")
        return False
    try:
        await send_message(chat_id, text, parse_mode="HTML")
        return True
    except TelegramApiError as e:
        msg = str(e).lower()
        if "parse" in msg or "entity" in msg:
            try:
                await send_message(chat_id, _plain_fallback(text), parse_mode=None)
                return True
            except TelegramApiError as e2:
                logger.warning("Telegram notify (plain) failed chat=%s: %s", chat_id, e2)
                return False
        logger.warning("Telegram notify failed chat=%s: %s", chat_id, e)
        return False
    except Exception as e:
        logger.warning("Telegram notify failed chat=%s: %s", chat_id, e)
        return False


async def _send_photo(chat_id: int, image_path: Path, caption: str) -> bool:
    if not settings.bot_token:
        logger.warning("BOT_TOKEN не задан — фото не отправлено")
        return False
    try:
        await send_photo(chat_id, image_path, caption, parse_mode="HTML")
        return True
    except TelegramApiError as e:
        logger.warning("Telegram photo failed chat=%s: %s — текст отдельно", chat_id, e)
        return await _send_message(chat_id, caption)
    except Exception as e:
        logger.warning("Telegram photo failed chat=%s: %s", chat_id, e)
        return await _send_message(chat_id, caption)


async def _send_colored_card(
    chat_id: int,
    card_png: bytes,
    text: str,
) -> bool:
    caption = _plain_fallback(text)[:1024]
    if not settings.bot_token:
        logger.warning("BOT_TOKEN не задан — карточка не отправлена")
        return False
    try:
        await send_photo_bytes(chat_id, card_png, caption, parse_mode=None)
        return True
    except TelegramApiError as e:
        logger.warning("Telegram card failed chat=%s: %s — fallback to text", chat_id, e)
        return await _send_message(chat_id, text)
    except Exception as e:
        logger.warning("Telegram card failed chat=%s: %s", chat_id, e)
        return await _send_message(chat_id, text)


async def notify_subscribers(
    text: str,
    subscriber_ids: list[int],
    *,
    photo_rel_path: str | None = None,
    direction: str | None = None,
) -> int:
    """Возвращает число успешно доставленных push."""
    if not subscriber_ids:
        logger.info("Нет подписчиков для уведомления")
        return 0
    photo_file: Path | None = None
    if photo_rel_path:
        candidate = media_root() / photo_rel_path
        if candidate.is_file():
            photo_file = candidate
    card_png: bytes | None = None
    if direction:
        try:
            card_png = render_notify_card_png(text, direction=direction)
        except Exception as e:
            logger.warning("notify card render failed: %s", e)
    logger.info("Отправка уведомления %s подписчикам", len(subscriber_ids))

    async def _send_one(uid: int) -> bool:
        if card_png:
            return await _send_colored_card(uid, card_png, text)
        if photo_file:
            return await _send_photo(uid, photo_file, text)
        return await _send_message(uid, text)

    results = await asyncio.gather(*[_send_one(uid) for uid in subscriber_ids], return_exceptions=True)
    ok = sum(1 for r in results if r is True)
    fail = len(results) - ok
    if fail:
        logger.warning("Уведомления: доставлено %s, ошибок %s (часто: не нажали /start в боте)", ok, fail)
    else:
        logger.info("Уведомления: доставлено %s", ok)
    return ok


def format_new_signal_message(signal: Signal) -> str:
    return (
        f"⚡️ <b>НОВЫЙ СИГНАЛ</b>"
        f"{_signal_headline(signal)}"
        f"{_signal_body(signal)}"
    )


def format_updated_signal_message(signal: Signal, changes: list[str], *, actor_label: str | None = None) -> str:
    num = signal.number if signal.number is not None else signal.id
    parts = [
        f"✏️ <b>ОБНОВЛЕНИЕ</b>",
        _signal_headline(signal),
    ]
    if actor_label:
        parts.append(_highlight_block("Кто", _row("Изменил", f"<b>{_esc(actor_label)}</b>")))
    if changes:
        parts.append(_highlight_block("Изменения", "\n" + "\n".join(changes)))
    else:
        parts.append("\n<i>Параметры сигнала обновлены</i>")
    body = "".join(parts)
    if signal.status in ("win", "lose"):
        ret = _closed_price_move_pct(signal)
        pnl = signal_realized_pnl_for_read(signal) or 0
        sign = "+" if ret >= 0 else ""
        lev = signal_leverage(signal)
        lev_note = f" · <b>{lev}x</b>" if lev > 1 else ""
        result_body = (
            _row("Движение", _bold_price(_val(f"{sign}{ret:.2f}%")))
            + _row("P/L", _bold_price(_val(f"{pnl:+.0f}$")) + lev_note)
            + _row("Счёт", _bold_price(_val(f"${signal_pnl_base_usd(signal):,.0f}")))
        )
        body += _highlight_block("Итог", result_body)
    return body


def format_deleted_signal_message(signal: Signal, *, actor_label: str | None = None, reason: str | None = None) -> str:
    parts = [f"🗑 <b>СИГНАЛ СНЯТ</b>", _signal_headline(signal)]
    who_body = ""
    if actor_label:
        who_body += _row("Удалил", f"<b>{_esc(actor_label)}</b>")
    if reason and reason.strip():
        who_body += _row("Причина", f"<i>{_esc(reason.strip())}</i>")
    if who_body:
        parts.append(_highlight_block("Кто", who_body))
    parts.append(_signal_body(signal))
    return "".join(parts)


def _closed_price_move_pct(signal: Signal) -> float:
    return closed_signal_move_pct(signal)


def format_closed_signal_message(signal: Signal, *, market_close: bool = False) -> str:
    ret = _closed_price_move_pct(signal)
    pnl = signal_realized_pnl_for_read(signal) or 0
    sign = "+" if ret >= 0 else ""
    lev = signal_leverage(signal)
    lev_note = f" · <b>{lev}x</b>" if lev > 1 else ""
    if market_close:
        emoji, label = "📤", "ЗАКРЫТ ПО РЫНКУ"
    else:
        emoji = "🏆" if signal.status == "win" else "💥"
        label = "WIN" if signal.status == "win" else "LOSE"
    result_body = (
        _row("Движение", _bold_price(_val(f"{sign}{ret:.2f}%")))
        + _row("P/L трекера", _bold_price(_val(f"{pnl:+.0f}$")) + lev_note)
        + _row("Счёт", _bold_price(_val(f"${signal_pnl_base_usd(signal):,.0f}")))
    )
    return (
        f"{emoji} <b>{label}</b>"
        f"{_signal_headline(signal)}"
        + _highlight_block("Результат", result_body)
        + _author_block(signal)
    )


def format_supplement_message(
    signal: Signal,
    comment: str | None,
    *,
    has_image: bool = False,
    has_video: bool = False,
    actor_label: str | None = None,
) -> str:
    num = signal.number if signal.number is not None else signal.id
    parts = [
        f"➕ <b>ДОПОЛНЕНИЕ</b>\n<blockquote><b>#{num}</b> · <b>{_esc(signal.symbol)}</b> · {_direction_badge(signal.direction)}</blockquote>",
    ]
    if actor_label:
        parts.append(_section("Кто") + _row("Автор", f"<b>{_esc(actor_label)}</b>"))
    if comment and comment.strip():
        parts.append(_section("Текст") + f"\n<i>{_esc(comment.strip())}</i>")
    media: list[str] = []
    if has_image:
        media.append("📷 скрин")
    if has_video:
        media.append("🎬 видео")
    if media:
        parts.append(_section("Вложения") + _row("Файлы", " · ".join(media)))
    return "".join(parts)


def format_new_news_message(post: NewsPost, *, author_label: str | None = None) -> str:
    body = (post.body or "").strip()
    if len(body) > 280:
        body = body[:277] + "…"
    parts = [
        f"📰 <b>НОВОСТЬ</b>\n<blockquote><b>{_esc(post.title)}</b></blockquote>",
    ]
    if body:
        parts.append(_section("Текст") + f"\n<i>{_esc(body)}</i>")
    extras: list[str] = []
    if post.video_path:
        extras.append("🎬 видео в приложении")
    if post.link_url:
        extras.append(f"🔗 {_esc(post.link_url)}")
    if extras:
        parts.append(_section("Ещё") + "\n" + "\n".join(f"▸ {x}" for x in extras))
    if author_label:
        parts.append(_section("Редакция") + _row("Автор", f"<b>{_esc(author_label)}</b>"))
    return "".join(parts)


async def notify_copy_deposit_empty(telegram_user_id: int) -> None:
    """Уведомить пользователя что депозит копирования закончился и копирование остановлено."""
    text = (
        "⚠️ <b>КОПИРОВАНИЕ ОСТАНОВЛЕНО</b>\n\n"
        "Депозит для автокопирования volnovoi исчерпан — "
        "новые сделки больше не копируются на ваш Bybit-счёт.\n\n"
        "▸ Пополните депозит в разделе <b>Копирование</b>, "
        "чтобы возобновить копирование."
    )
    await _send_message(telegram_user_id, text)


def format_entry_filled_message(signal: Signal) -> str:
    is_market = not entry_zone_defined(signal.entry_low, signal.entry_high)
    status_line = (
        "▸ Вход <b>по рынку</b> — позиция в работе"
        if is_market
        else "▸ Лимитка <b>сработала</b> — позиция в работе"
    )
    return (
        f"🎯 <b>В РЫНКЕ</b>"
        f"{_signal_headline(signal)}"
        + _highlight_block("Статус", f"\n{status_line}")
        + _levels_block(signal)
        + _author_block(signal)
    )
