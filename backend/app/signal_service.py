from __future__ import annotations

from datetime import datetime, timezone

import logging

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import NewsPost, Signal, Subscriber, Trader
from app.subscription_billing import subscriber_ids_for_news_notify, subscription_active_strict
from app.signal_utils import compute_signal_points_percent, entry_zone_defined, signal_in_trade, trade_move_pct
from app.telegram_avatar import ensure_trader_avatar
from app.schemas import TelegramUser
from app.serializers import trader_display_name
from app.telegram_notify import (
    format_actor_label,
    format_closed_signal_message,
    format_deleted_signal_message,
    format_entry_filled_message,
    format_new_news_message,
    format_new_signal_message,
    format_supplement_message,
    format_updated_signal_message,
    notify_subscribers,
)
from app.challenge_service import apply_signal_to_tracker, ensure_tracker_for_new_signal
from app.price_service import (
    PriceQuote,
    clear_price_cache,
    fetch_bybit_perp_quote,
    fetch_market_quotes,
    fetch_price,
    first_entry_quote,
)
from app.subscription_billing import register_subscriber_with_meta
from app.trader_stats import apply_outcome_to_trader

logger = logging.getLogger(__name__)


def _normalize_trader_stats(trader: Trader) -> None:
    if trader.wins is None:
        trader.wins = 0
    if trader.losses is None:
        trader.losses = 0
    if trader.rating_percent is None:
        trader.rating_percent = 0.0
    if trader.total_pnl_usd is None:
        trader.total_pnl_usd = 0.0


def get_or_create_trader(
    db: Session,
    telegram_id: int,
    username: str | None,
    *,
    first_name: str | None = None,
    last_name: str | None = None,
    photo_url: str | None = None,
) -> Trader:
    trader = db.get(Trader, telegram_id)
    if trader is None:
        trader = Trader(
            telegram_id=telegram_id,
            username=username,
            first_name=first_name,
            last_name=last_name,
            wins=0,
            losses=0,
            rating_percent=0.0,
            total_pnl_usd=0.0,
        )
        db.add(trader)
    else:
        _normalize_trader_stats(trader)
        if username and trader.username != username:
            trader.username = username
        if first_name and trader.first_name != first_name:
            trader.first_name = first_name
        if last_name and trader.last_name != last_name:
            trader.last_name = last_name
    path = ensure_trader_avatar(telegram_id, photo_url)
    if path:
        trader.avatar_path = path
        db.flush()
    elif trader.avatar_path:
        from app.media_storage import media_root

        if not (media_root() / trader.avatar_path).is_file():
            trader.avatar_path = None
            db.flush()
    return trader


def sync_admin_avatars(db: Session) -> None:
    """Подтягивает аватары всех админов через Bot API (если ещё нет на диске)."""
    for aid in settings.admin_id_set:
        trader = db.get(Trader, aid)
        get_or_create_trader(
            db,
            aid,
            trader.username if trader else None,
            first_name=trader.first_name if trader else None,
            last_name=trader.last_name if trader else None,
        )


def register_subscriber(db: Session, telegram_id: int, username: str | None, start_param: str | None = None) -> Subscriber:
    return register_subscriber_with_meta(db, telegram_id, username, start_param)


def resolve_actor_label(db: Session, actor: TelegramUser) -> str:
    trader = get_or_create_trader(
        db,
        actor.telegram_user_id,
        actor.username,
        first_name=actor.first_name,
        last_name=actor.last_name,
    )
    display = trader_display_name(trader, actor.username or trader.username)
    return format_actor_label(
        display_name=display,
        username=actor.username or trader.username,
        telegram_id=actor.telegram_user_id,
    )


def subscriber_ids_for_notify(db: Session) -> list[int]:
    """Подписчики с notify_enabled и действующей подпиской (trial или платной)."""
    admin_ids = settings.admin_id_set
    subs = db.scalars(select(Subscriber).where(Subscriber.notify_enabled.is_(True))).all()
    ids: list[int] = []
    for sub in subs:
        is_admin = sub.telegram_user_id in admin_ids
        if subscription_active_strict(sub, is_admin=is_admin):
            ids.append(sub.telegram_user_id)
    if not ids:
        logger.info("subscriber_ids_for_notify: 0 получателей (notify_enabled + активная подписка)")
    return ids


async def notify_new_signal(db: Session, signal: Signal) -> None:
    ids = subscriber_ids_for_notify(db)
    if ids:
        await notify_subscribers(format_new_signal_message(signal), ids)


async def notify_new_news(db: Session, post: NewsPost) -> None:
    ids = subscriber_ids_for_news_notify(db)
    if not ids:
        logger.info("notify_new_news: 0 получателей")
        return
    logger.info("notify_new_news: %s получателей (все пользователи mini app)", len(ids))
    trader = db.get(Trader, post.author_telegram_id)
    author = None
    if trader:
        from app.serializers import trader_display_name

        author = trader_display_name(trader, trader.username)
    await notify_subscribers(
        format_new_news_message(post, author_label=author),
        ids,
        photo_rel_path=post.image_path,
    )


async def notify_updated_signal(
    db: Session,
    signal: Signal,
    changes: list[str],
    *,
    actor: TelegramUser,
) -> None:
    ids = subscriber_ids_for_notify(db)
    if ids:
        label = resolve_actor_label(db, actor)
        await notify_subscribers(format_updated_signal_message(signal, changes, actor_label=label), ids)


async def notify_deleted_signal(db: Session, signal: Signal, *, actor: TelegramUser) -> None:
    ids = subscriber_ids_for_notify(db)
    if ids:
        label = resolve_actor_label(db, actor)
        await notify_subscribers(format_deleted_signal_message(signal, actor_label=label), ids)


def close_signal(
    db: Session,
    signal: Signal,
    outcome: str,
    exit_price: float | None = None,
    *,
    close_reason: str | None = None,
) -> bool:
    if signal.status != "active":
        return False
    signal.status = outcome
    signal.closed_at = datetime.now(timezone.utc)
    if close_reason:
        signal.close_reason = close_reason
    elif outcome == "win":
        signal.close_reason = "target"
    elif outcome == "lose":
        signal.close_reason = "stop"
    if exit_price is not None:
        signal.closed_exit_price = round(float(exit_price), 8)
    trader = get_or_create_trader(db, signal.author_telegram_id, signal.author_username)
    _normalize_trader_stats(trader)
    apply_outcome_to_trader(trader, signal, outcome, exit_price)
    apply_signal_to_tracker(db, signal)
    db.commit()
    db.refresh(signal)
    return True


async def close_signal_and_notify(
    db: Session,
    signal: Signal,
    outcome: str,
    exit_price: float | None = None,
    *,
    close_reason: str | None = None,
    market_close: bool = False,
) -> None:
    reason = close_reason or ("market" if market_close else None)
    if not close_signal(db, signal, outcome, exit_price, close_reason=reason):
        return
    ids = subscriber_ids_for_notify(db)
    if ids:
        await notify_subscribers(format_closed_signal_message(signal, market_close=market_close), ids)


async def close_signal_at_market(db: Session, signal: Signal) -> None:
    """Ручное закрытие активного сигнала по текущей рыночной цене."""
    if signal.status in ("win", "lose"):
        return
    if not signal_in_trade(signal):
        raise ValueError("not_in_trade")
    clear_price_cache()
    quote = await fetch_bybit_perp_quote(signal.symbol)
    exit_price = quote.price if quote is not None else await fetch_price(signal.symbol)
    if exit_price is None:
        raise ValueError("no_price")
    move = trade_move_pct(
        signal.entry_low,
        signal.entry_high,
        signal.direction,
        "win",
        exit_price=exit_price,
    )
    outcome = "win" if move > 0 else "lose"
    await close_signal_and_notify(db, signal, outcome, exit_price=exit_price, market_close=True)
    if signal.status == "active":
        raise ValueError("close_failed")


async def notify_entry_filled(db: Session, signal: Signal) -> None:
    ids = subscriber_ids_for_notify(db)
    if ids:
        await notify_subscribers(format_entry_filled_message(signal), ids)


async def notify_signal_supplement(
    db: Session,
    signal: Signal,
    comment: str | None,
    *,
    actor: TelegramUser,
    has_image: bool = False,
    has_video: bool = False,
) -> None:
    ids = subscriber_ids_for_notify(db)
    if ids:
        label = resolve_actor_label(db, actor)
        await notify_subscribers(
            format_supplement_message(
                signal,
                comment,
                has_image=has_image,
                has_video=has_video,
                actor_label=label,
            ),
            ids,
        )


async def stamp_signal_at_publication(
    db: Session,
    signal: Signal,
    *,
    notify_entry: bool = True,
) -> None:
    """Цена Bybit USDT perpetual в момент публикации и фиксация времени размещения."""
    clear_price_cache()
    published_at = datetime.now(timezone.utc)
    perp = await fetch_bybit_perp_quote(signal.symbol)
    quotes: list[PriceQuote] = [perp] if perp is not None else []

    signal.created_at = published_at
    entry_hit: PriceQuote | None = None

    if quotes:
        signal.published_market_price = quotes[0].price
        signal.published_market_source = quotes[0].source
        if entry_zone_defined(signal.entry_low, signal.entry_high):
            entry_hit = first_entry_quote(quotes, signal.direction, signal.entry_low, signal.entry_high)
            if entry_hit:
                signal.entry_filled_at = published_at
                signal.published_market_price = entry_hit.price
                signal.published_market_source = entry_hit.source
        else:
            signal.entry_filled_at = published_at
    elif not entry_zone_defined(signal.entry_low, signal.entry_high):
        signal.entry_filled_at = published_at

    db.commit()
    db.refresh(signal)

    if entry_hit:
        logger.info(
            "Публикация signal #%s %s: %s=%.4f, вход сразу",
            signal.id,
            signal.symbol,
            entry_hit.source,
            entry_hit.price,
        )
    elif signal.published_market_price is not None:
        logger.info(
            "Публикация signal #%s %s: %s=%.4f",
            signal.id,
            signal.symbol,
            signal.published_market_source,
            signal.published_market_price,
        )
    else:
        logger.warning("Публикация signal #%s %s: цена бирж не получена", signal.id, signal.symbol)

    if notify_entry and entry_hit:
        await notify_entry_filled(db, signal)


async def try_fill_entry_from_market(db: Session, signal: Signal, *, notify: bool = True) -> bool:
    """Если цена уже прошла уровень входа — сразу отмечаем сигнал активным."""
    if signal.entry_filled_at is not None or signal.status != "active":
        return False
    if not entry_zone_defined(signal.entry_low, signal.entry_high):
        return False
    quotes = await fetch_market_quotes(signal.symbol)
    if not quotes:
        logger.warning(
            "Нет цены для %s — вход не проверен (signal #%s)",
            signal.symbol,
            signal.id,
        )
        return False
    hit = first_entry_quote(quotes, signal.direction, signal.entry_low, signal.entry_high)
    if hit is None:
        return False
    signal.entry_filled_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(signal)
    logger.info(
        "Вход сработал: signal #%s %s %s, %s=%.4f, entry=%s/%s",
        signal.id,
        signal.symbol,
        signal.direction,
        hit.source,
        hit.price,
        signal.entry_low,
        signal.entry_high,
    )
    if notify:
        await notify_entry_filled(db, signal)
    return True


async def sync_pending_entry_fills(
    db: Session,
    signals: list[Signal] | None = None,
    *,
    notify: bool = False,
) -> int:
    """Проверить активные сигналы без входа и отметить сработавшие по рынку."""
    if signals is None:
        stmt = select(Signal).where(Signal.status == "active", Signal.entry_filled_at.is_(None))
        pending = list(db.scalars(stmt).all())
    else:
        pending = [
            s
            for s in signals
            if s.status == "active"
            and s.entry_filled_at is None
            and entry_zone_defined(s.entry_low, s.entry_high)
        ]
    if not pending:
        return 0
    clear_price_cache()
    filled = 0
    for signal in pending:
        if await try_fill_entry_from_market(db, signal, notify=notify):
            filled += 1
    if filled:
        logger.info("Синхронизировано входов: %s", filled)
    return filled


def next_signal_number(db: Session) -> int:
    mx = db.scalar(select(func.max(Signal.number)))
    return 1 if mx is None else int(mx) + 1


def build_signal_row(
    db: Session,
    *,
    symbol: str,
    direction: str,
    entry_low: str | None,
    entry_high: str | None,
    stop_loss: str | None,
    take_profits: str | None,
    comment: str | None,
    author_telegram_id: int,
    author_username: str | None,
    leverage: int | None = None,
    risk_percent: float | None = None,
    tracker_balance: float | None = None,
    author_first_name: str | None = None,
    author_last_name: str | None = None,
) -> Signal:
    points = risk_percent if risk_percent is not None else compute_signal_points_percent(entry_low, entry_high, stop_loss)
    get_or_create_trader(
        db,
        author_telegram_id,
        author_username,
        first_name=author_first_name,
        last_name=author_last_name,
    )
    return Signal(
        number=next_signal_number(db),
        symbol=symbol,
        direction=direction,
        entry_low=entry_low,
        entry_high=entry_high,
        stop_loss=stop_loss,
        take_profits=take_profits,
        comment=comment,
        status="active",
        entry_filled_at=None,
        points_percent=points,
        leverage=leverage,
        risk_percent=risk_percent or points,
        tracker_balance=tracker_balance,
        views_count=0,
        likes_count=0,
        author_telegram_id=author_telegram_id,
        author_username=author_username,
    )


def update_signal_fields(
    signal: Signal,
    *,
    symbol: str,
    direction: str,
    entry_low: str | None,
    entry_high: str | None,
    stop_loss: str | None,
    take_profits: str | None,
    comment: str | None,
    leverage: int | None,
    risk_percent: float | None,
    tracker_balance: float | None,
) -> None:
    signal.symbol = symbol
    signal.direction = direction
    signal.entry_low = entry_low
    signal.entry_high = entry_high
    signal.stop_loss = stop_loss
    signal.take_profits = take_profits
    signal.comment = comment
    signal.leverage = leverage
    if risk_percent is not None:
        signal.risk_percent = risk_percent
        signal.points_percent = risk_percent
    if tracker_balance is not None:
        signal.tracker_balance = tracker_balance
