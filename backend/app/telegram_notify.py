from __future__ import annotations

import html
import logging
from dataclasses import dataclass
from pathlib import Path

import httpx

from app.config import settings
from app.media_storage import media_root
from app.models import NewsPost, Signal
from app.signal_utils import parse_take_profit_levels
from app.trader_stats import signal_entry_stake_pct, signal_entry_stake_usd, signal_tracker_balance, signal_trade_return_pct

logger = logging.getLogger(__name__)

API = "https://api.telegram.org/bot{token}/{method}"


def _esc(value: object | None) -> str:
    if value is None or value == "":
        return "—"
    return html.escape(str(value))


def _format_take_profits(raw: str | None) -> str:
    levels = parse_take_profit_levels(raw)
    if not levels:
        return "—"
    return ", ".join(_esc(x) for x in levels)


def _entry_label(entry_low: str | None, entry_high: str | None) -> str:
    low, high = entry_low, entry_high
    if low and high and low != high:
        return f"{_esc(low)} – {_esc(high)}"
    return _esc(low or high)


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
            lines.append(f"• {label}: {o} → {n}")

    _cmp("Инструмент", before.symbol, after_snap.symbol)
    if before.direction != after_snap.direction:
        lines.append(f"• Направление: {_esc(before.direction.upper())} → {_esc(after_snap.direction.upper())}")

    before_entry = _entry_label(before.entry_low, before.entry_high)
    after_entry = _entry_label(after_snap.entry_low, after_snap.entry_high)
    if before_entry != after_entry:
        lines.append(f"• Вход: {before_entry} → {after_entry}")

    _cmp("Стоп", before.stop_loss, after_snap.stop_loss)
    _cmp("Цель", _format_take_profits(before.take_profits), _format_take_profits(after_snap.take_profits), fmt=str)
    _cmp("Плечо", before.leverage, after_snap.leverage)
    if before.risk_percent != after_snap.risk_percent:
        lines.append(f"• Сумма входа %: {_esc(before.risk_percent)} → {_esc(after_snap.risk_percent)}")
    if (before.comment or "") != (after_snap.comment or ""):
        lines.append(f"• Комментарий: {_esc(before.comment)} → {_esc(after_snap.comment)}")

    if image_removed:
        lines.append("• Скрин: удалён")
    elif image_added:
        lines.append("• Скрин: добавлен")
    if video_removed:
        lines.append("• Видео: удалено")
    elif video_added:
        lines.append("• Видео: добавлено")

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
        return f"{name} (@{login})"
    if name:
        return name
    if login:
        return f"@{login}"
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


def _signal_summary(signal: Signal) -> str:
    author = _esc(_signal_author_label(signal))
    stake = signal_entry_stake_pct(signal)
    stake_usd = signal_entry_stake_usd(signal)
    tracker = signal_tracker_balance(signal)
    lines = [
        f"{_esc(signal.symbol)} · <b>{_esc(signal.direction.upper())}</b>",
        f"Вход: {_entry_label(signal.entry_low, signal.entry_high)}",
        f"Стоп: {_esc(signal.stop_loss)}",
        f"Цель: {_format_take_profits(signal.take_profits)}",
        f"Сумма входа: {stake}% (${stake_usd:,.0f}) · Трекер: ${tracker:,.0f}",
    ]
    if signal.published_market_price is not None:
        src = _market_source_label(signal.published_market_source)
        src_part = f" ({src})" if src else ""
        lines.append(f"Рынок при публикации: {signal.published_market_price:g}{src_part}")
    lines.append(f"Автор: {author}")
    return "\n".join(lines)


async def _send_message(chat_id: int, text: str) -> None:
    if not settings.bot_token:
        logger.warning("BOT_TOKEN не задан — уведомление не отправлено")
        return
    url = API.format(token=settings.bot_token, method="sendMessage")
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(url, json=payload)
            if r.status_code != 200:
                logger.warning("Telegram sendMessage %s chat=%s: %s", r.status_code, chat_id, r.text[:300])
    except Exception as e:
        logger.warning("Telegram notify failed chat=%s: %s", chat_id, e)


async def _send_photo(chat_id: int, image_path: Path, caption: str) -> None:
    if not settings.bot_token:
        logger.warning("BOT_TOKEN не задан — фото не отправлено")
        return
    url = API.format(token=settings.bot_token, method="sendPhoto")
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            with image_path.open("rb") as f:
                r = await client.post(
                    url,
                    data={"chat_id": str(chat_id), "caption": caption, "parse_mode": "HTML"},
                    files={"photo": (image_path.name, f, "image/jpeg")},
                )
            if r.status_code != 200:
                logger.warning("Telegram sendPhoto %s chat=%s: %s", r.status_code, chat_id, r.text[:300])
                await _send_message(chat_id, caption)
    except Exception as e:
        logger.warning("Telegram photo failed chat=%s: %s", chat_id, e)
        await _send_message(chat_id, caption)


async def notify_subscribers(text: str, subscriber_ids: list[int], *, photo_rel_path: str | None = None) -> None:
    if not subscriber_ids:
        logger.info("Нет подписчиков для уведомления")
        return
    photo_file: Path | None = None
    if photo_rel_path:
        candidate = media_root() / photo_rel_path
        if candidate.is_file():
            photo_file = candidate
    logger.info("Отправка уведомления %s подписчикам", len(subscriber_ids))
    for uid in subscriber_ids:
        if photo_file:
            await _send_photo(uid, photo_file, text)
        else:
            await _send_message(uid, text)


def format_new_signal_message(signal: Signal) -> str:
    return f"📢 <b>Новый сигнал</b>\n{_signal_summary(signal)}"


def format_updated_signal_message(signal: Signal, changes: list[str], *, actor_label: str | None = None) -> str:
    header = f"✏️ <b>Сигнал обновлён</b>\n{_esc(signal.symbol)} · <b>{_esc(signal.direction.upper())}</b>\n"
    if actor_label:
        header += f"<b>Изменил:</b> {_esc(actor_label)}\n"
    if changes:
        body = "<b>Изменения:</b>\n" + "\n".join(changes)
    else:
        body = "Обновлены параметры сигнала."
    return header + body


def format_deleted_signal_message(signal: Signal, *, actor_label: str | None = None) -> str:
    head = "🗑 <b>Сигнал удалён</b>\n"
    if actor_label:
        head += f"<b>Удалил:</b> {_esc(actor_label)}\n"
    return head + _signal_summary(signal)


def format_closed_signal_message(signal: Signal) -> str:
    emoji = "✅" if signal.status == "win" else "❌"
    label = "WIN" if signal.status == "win" else "LOSE"
    ret = signal_trade_return_pct(signal, signal.status)
    pnl = signal.realized_pnl or 0
    sign = "+" if ret >= 0 else ""
    return (
        f"{emoji} <b>Сигнал {label}</b>\n"
        f"{_esc(signal.symbol)} · {_esc(signal.direction.upper())}\n"
        f"Доходность: {sign}{ret:.2f}% · P/L: {pnl:+.0f}$\n"
        f"Трекер сигнала: ${signal_tracker_balance(signal):,.0f}\n"
        f"Автор: {_esc(_signal_author_label(signal))}"
    )


def format_supplement_message(
    signal: Signal,
    comment: str | None,
    *,
    has_image: bool = False,
    has_video: bool = False,
    actor_label: str | None = None,
) -> str:
    parts = [f"➕ <b>Дополнение к сигналу</b>\n{_esc(signal.symbol)} · {_esc(signal.direction.upper())}"]
    if actor_label:
        parts.append(f"\n<b>Дополнил:</b> {_esc(actor_label)}")
    if comment and comment.strip():
        parts.append(f"\n{_esc(comment.strip())}")
    media: list[str] = []
    if has_image:
        media.append("скрин")
    if has_video:
        media.append("видео")
    if media:
        parts.append(f"\n<b>Добавлено:</b> {', '.join(media)}")
    return "".join(parts)


def format_new_news_message(post: NewsPost, *, author_label: str | None = None) -> str:
    body = (post.body or "").strip()
    if len(body) > 280:
        body = body[:277] + "…"
    lines = [f"📰 <b>Новость</b>", f"<b>{_esc(post.title)}</b>"]
    if body:
        lines.append(_esc(body))
    if post.video_path:
        lines.append("🎬 Есть видео в приложении")
    if author_label:
        lines.append(f"Автор: {_esc(author_label)}")
    return "\n".join(lines)


def format_entry_filled_message(signal: Signal) -> str:
    author = _esc(_signal_author_label(signal))
    return (
        f"🎯 <b>Вход в зоне</b>\n"
        f"{_esc(signal.symbol)} · <b>{_esc(signal.direction.upper())}</b>\n"
        f"Цена достигла уровня входа — позиция в работе.\n"
        f"Вход: {_entry_label(signal.entry_low, signal.entry_high)}\n"
        f"Автор: {author}"
    )
