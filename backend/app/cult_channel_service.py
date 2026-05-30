"""Каналы-кандидаты CULT: CRUD, ingest постов, статистика %."""

from __future__ import annotations

import re
from collections import defaultdict
from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.channel_signal_parser import parse_channel_signal
from app.models import CultChannel, CultChannelSignal
from app.schemas import CultChannelRead, TraderDayStat
from app.signal_utils import (
    effective_entry_price,
    outcome_from_move,
    price_move_pct,
    trade_move_pct,
)
from app.telegram_bot_api import get_chat


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def normalize_channel_username(raw: str) -> str:
    s = raw.strip()
    s = re.sub(r"^https?://(t\.me|telegram\.me)/", "", s, flags=re.IGNORECASE)
    s = s.split("?")[0].strip("/")
    if s.startswith("@"):
        s = s[1:]
    if "/" in s:
        s = s.split("/")[-1]
    if not re.fullmatch(r"[A-Za-z0-9_]{4,64}", s):
        raise ValueError("Некорректная ссылка или @username канала")
    return s.lower()


def channel_public_url(username: str) -> str:
    return f"https://t.me/{username}"


def resolve_channel(username: str) -> tuple[int, str, str]:
    """chat_id, title, username."""
    chat = get_chat(f"@{username}")
    chat_id = int(chat["id"])
    title = str(chat.get("title") or username)
    uname = str(chat.get("username") or username).lower()
    if chat.get("type") != "channel":
        raise ValueError("Это не публичный канал. Добавьте бота админом в канал.")
    return chat_id, title, uname


def add_cult_channel(db: Session, url: str, added_by: int | None) -> CultChannel:
    username = normalize_channel_username(url)
    existing = db.scalar(select(CultChannel).where(CultChannel.username == username))
    if existing:
        raise ValueError("Канал уже подключён")

    chat_id, title, uname = resolve_channel(username)
    row = CultChannel(
        title=title,
        username=uname,
        chat_id=chat_id,
        channel_url=channel_public_url(uname),
        connected_at=_now(),
        added_by_telegram_id=added_by,
    )
    db.add(row)
    db.flush()
    return row


def delete_cult_channel(db: Session, channel_id: int) -> None:
    row = db.get(CultChannel, channel_id)
    if row is None:
        raise ValueError("Канал не найден")
    db.execute(delete(CultChannelSignal).where(CultChannelSignal.cult_channel_id == channel_id))
    db.delete(row)


def _closed_move_pct(sig: CultChannelSignal) -> float:
    entry = effective_entry_price(sig.entry_low, sig.entry_high, sig.published_market_price)
    if entry is None or sig.closed_exit_price is None:
        return 0.0
    return price_move_pct(entry, sig.direction, float(sig.closed_exit_price))


def apply_outcome_to_channel(db: Session, channel: CultChannel, sig: CultChannelSignal, outcome: str, exit_price: float) -> None:
    move = trade_move_pct(
        sig.entry_low,
        sig.entry_high,
        sig.direction,
        outcome,
        exit_price=exit_price,
        stop_loss=sig.stop_loss,
        take_profits=sig.take_profits,
    )
    outcome = outcome_from_move(move)
    sig.status = outcome
    sig.closed_at = _now()
    sig.closed_exit_price = exit_price
    sig.close_reason = "target" if outcome == "win" else "stop"

    if move >= 0:
        channel.wins += 1
    else:
        channel.losses += 1
    channel.rating_percent = round((channel.rating_percent or 0) + move, 2)


def ingest_channel_post(db: Session, chat_id: int, message: dict) -> CultChannelSignal | None:
    channel = db.scalar(select(CultChannel).where(CultChannel.chat_id == chat_id, CultChannel.enabled.is_(True)))
    if channel is None:
        channel = db.scalar(
            select(CultChannel).where(
                CultChannel.username == str(message.get("chat", {}).get("username", "")).lower(),
                CultChannel.enabled.is_(True),
            )
        )
    if channel is None:
        return None

    msg_id = int(message["message_id"])
    dup = db.scalar(
        select(CultChannelSignal).where(
            CultChannelSignal.cult_channel_id == channel.id,
            CultChannelSignal.telegram_message_id == msg_id,
        )
    )
    if dup:
        return None

    msg_date = _as_utc(datetime.fromtimestamp(int(message["date"]), tz=timezone.utc))
    if msg_date < _as_utc(channel.connected_at):
        return None

    text = message.get("text") or message.get("caption") or ""
    parsed = parse_channel_signal(text)
    if parsed is None:
        return None

    sig = CultChannelSignal(
        cult_channel_id=channel.id,
        telegram_message_id=msg_id,
        message_date=msg_date,
        symbol=parsed.symbol,
        direction=parsed.direction,
        entry_low=parsed.entry_low,
        entry_high=parsed.entry_high,
        stop_loss=parsed.stop_loss,
        take_profits=parsed.take_profits,
        status="active",
    )
    db.add(sig)
    if channel.chat_id is None:
        channel.chat_id = chat_id
    db.flush()
    return sig


def _daily_stats(db: Session, channel_ids: list[int]) -> dict[int, list[TraderDayStat]]:
    if not channel_ids:
        return {}
    rows = db.scalars(
        select(CultChannelSignal).where(
            CultChannelSignal.cult_channel_id.in_(channel_ids),
            CultChannelSignal.status.in_(("win", "lose")),
        )
    ).all()
    buckets: dict[int, dict[str, dict]] = defaultdict(lambda: defaultdict(lambda: {"rating": 0.0, "w": 0, "l": 0}))
    for s in rows:
        move = _closed_move_pct(s)
        day = s.closed_at.astimezone(timezone.utc).date().isoformat() if s.closed_at else s.message_date.date().isoformat()
        b = buckets[s.cult_channel_id][day]
        b["rating"] = round(b["rating"] + move, 2)
        if move >= 0:
            b["w"] += 1
        else:
            b["l"] += 1
    out: dict[int, list[TraderDayStat]] = {}
    for cid, days in buckets.items():
        out[cid] = [
            TraderDayStat(date=d, pnl_usd=0.0, rating_delta=v["rating"], wins=v["w"], losses=v["l"])
            for d, v in sorted(days.items(), reverse=True)
        ][:90]
    return out


def build_cult_channels_read(db: Session) -> list[CultChannelRead]:
    rows = list(db.scalars(select(CultChannel).where(CultChannel.enabled.is_(True)).order_by(CultChannel.id)).all())
    if not rows:
        return []
    daily = _daily_stats(db, [r.id for r in rows])
    ranked = sorted(rows, key=lambda c: (-(c.rating_percent or 0), -(c.wins or 0)))
    result: list[CultChannelRead] = []
    for rank, ch in enumerate(ranked, start=1):
        total = (ch.wins or 0) + (ch.losses or 0)
        wr = round((ch.wins or 0) / total * 100, 1) if total else 0.0
        result.append(
            CultChannelRead(
                id=ch.id,
                title=ch.title,
                username=ch.username,
                channel_url=ch.channel_url,
                rating_percent=float(ch.rating_percent or 0),
                wins=ch.wins or 0,
                losses=ch.losses or 0,
                rank=rank,
                win_rate=wr,
                connected_at=ch.connected_at,
                daily_stats=daily.get(ch.id, []),
            )
        )
    return result
