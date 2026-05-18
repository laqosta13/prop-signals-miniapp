from __future__ import annotations

import logging

import httpx

from app.config import settings
from app.models import Signal
from app.signal_utils import parse_take_profit_levels
from app.trader_stats import signal_entry_stake_pct, signal_tracker_balance

logger = logging.getLogger(__name__)

API = "https://api.telegram.org/bot{token}/{method}"


def _format_take_profits(raw: str | None) -> str:
    levels = parse_take_profit_levels(raw)
    if not levels:
        return "—"
    return ", ".join(str(x) for x in levels)


def _signal_summary(signal: Signal) -> str:
    author = f"@{signal.author_username}" if signal.author_username else f"id {signal.author_telegram_id}"
    stake = signal_entry_stake_pct(signal)
    tracker = signal_tracker_balance(signal)
    return (
        f"{signal.symbol} · <b>{signal.direction.upper()}</b>\n"
        f"Вход: {signal.entry_low or signal.entry_high or '—'}\n"
        f"Стоп: {signal.stop_loss or '—'}\n"
        f"Цель: {_format_take_profits(signal.take_profits)}\n"
        f"Сумма входа: {stake}% · Трекер: ${tracker:,.0f}\n"
        f"Автор: {author}"
    )


async def _send_message(chat_id: int, text: str) -> None:
    if not settings.bot_token:
        return
    url = API.format(token=settings.bot_token, method="sendMessage")
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(url, json=payload)
            if r.status_code != 200:
                logger.warning("Telegram sendMessage %s: %s", r.status_code, r.text[:200])
    except Exception as e:
        logger.warning("Telegram notify failed: %s", e)


async def notify_subscribers(text: str, subscriber_ids: list[int]) -> None:
    for uid in subscriber_ids:
        await _send_message(uid, text)


def format_new_signal_message(signal: Signal) -> str:
    return f"📢 <b>Новый сигнал</b>\n{_signal_summary(signal)}"


def format_updated_signal_message(signal: Signal) -> str:
    return f"✏️ <b>Сигнал обновлён</b>\n{_signal_summary(signal)}"


def format_deleted_signal_message(signal: Signal) -> str:
    return f"🗑 <b>Сигнал удалён</b>\n{_signal_summary(signal)}"


def format_closed_signal_message(signal: Signal) -> str:
    emoji = "✅" if signal.status == "win" else "❌"
    label = "WIN" if signal.status == "win" else "LOSE"
    stake = signal_entry_stake_pct(signal)
    sign = "+" if signal.status == "win" else "−"
    pnl = signal.realized_pnl or 0
    return (
        f"{emoji} <b>Сигнал {label}</b>\n"
        f"{signal.symbol} · {signal.direction.upper()}\n"
        f"Рейтинг: {sign}{stake}% · P/L: {pnl:+.0f}$\n"
        f"Трекер сигнала: ${signal_tracker_balance(signal):,.0f}"
    )


def format_entry_filled_message(signal: Signal) -> str:
    author = f"@{signal.author_username}" if signal.author_username else f"id {signal.author_telegram_id}"
    return (
        f"🎯 <b>Вход в зоне</b>\n"
        f"{signal.symbol} · <b>{signal.direction.upper()}</b>\n"
        f"Цена достигла уровня входа — позиция в работе.\n"
        f"Автор: {author}"
    )
