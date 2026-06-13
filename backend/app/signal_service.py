from __future__ import annotations

from datetime import datetime, timezone

import logging

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import NewsPost, Signal, Subscriber, Trader
from app.subscription_billing import register_subscriber_with_meta, subscriber_ids_for_news_notify, subscription_active_strict
from app.signal_utils import (
    compute_signal_points_percent,
    compute_signal_points_percent_from_price,
    entry_zone_defined,
    monitor_exit_price,
    outcome_from_move,
    signal_in_trade,
    trade_move_pct,
)

from app.trader_stats import DEFAULT_ENTRY_STAKE_PCT, apply_outcome_to_trader
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
from app.copy_trading_service import close_signal_copies, open_signal_copies, open_signal_copy_for_user
from app.challenge_service import apply_signal_to_tracker, ensure_tracker_for_new_signal
from app.database import SessionLocal
from app.price_service import (
    PriceQuote,
    clear_price_cache,
    fetch_bybit_perp_quote,
    fetch_market_quotes,
    fetch_price,
    first_entry_quote,
    monitor_outcome_for_signal,
)
from app.telegram_avatar import ensure_trader_avatar

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
    from app.rank_constants import INITIAL_RANK_ID

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
            current_rank_id=INITIAL_RANK_ID,
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
    from app.media_storage import media_root

    avatar_ok = bool(
        trader.avatar_path and (media_root() / trader.avatar_path).is_file()
    )
    if not avatar_ok:
        path = ensure_trader_avatar(telegram_id, photo_url)
        if path:
            trader.avatar_path = path
            db.flush()
        elif trader.avatar_path:
            trader.avatar_path = None
            db.flush()
    return trader


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
    admin_ids = settings.all_admin_id_set
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
        await notify_subscribers(
            format_new_signal_message(signal),
            ids,
            direction=signal.direction,
        )


async def notify_new_news(db: Session, post: NewsPost) -> None:
    ids = subscriber_ids_for_news_notify(db)
    if not ids:
        logger.info("notify_new_news: 0 получателей")
        return
    logger.info("notify_new_news: %s получателей (notify_news_enabled)", len(ids))
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
        await notify_subscribers(
            format_updated_signal_message(signal, changes, actor_label=label),
            ids,
            direction=signal.direction,
        )


async def notify_deleted_signal(db: Session, signal: Signal, *, actor: TelegramUser) -> None:
    ids = subscriber_ids_for_notify(db)
    if ids:
        label = resolve_actor_label(db, actor)
        await notify_subscribers(
            format_deleted_signal_message(signal, actor_label=label),
            ids,
            direction=signal.direction,
        )


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
    if getattr(signal, "is_cult_candidate", False):
        from app.cult_candidate_service import apply_outcome_to_cult_candidate
        from app.models import CultCandidate

        candidate = db.get(CultCandidate, signal.author_telegram_id)
        if candidate is None:
            return False
        if exit_price is None:
            return False
        if not apply_outcome_to_cult_candidate(
            db, candidate, signal, outcome, exit_price, close_reason=close_reason
        ):
            return False
        db.commit()
        db.refresh(signal)
        return True

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


async def try_close_on_quotes(
    db: Session,
    signal: Signal,
    quotes: list[PriceQuote],
    *,
    notify: bool = True,
) -> bool:
    """Закрыть сигнал, если текущая цена уже за стопом или на цели."""
    if signal.status != "active" or not quotes:
        return False
    outcome_hit = monitor_outcome_for_signal(signal, quotes)
    if outcome_hit is None:
        return False
    outcome, hit = outcome_hit
    if outcome not in ("win", "lose"):
        return False
    exit_px = monitor_exit_price(
        outcome,
        direction=signal.direction,
        stop_loss=signal.stop_loss,
        take_profits=signal.take_profits,
        market_price=hit.price,
    )
    reason = "target" if outcome == "win" else "stop"
    if notify:
        await close_signal_and_notify(db, signal, outcome, exit_price=exit_px, close_reason=reason)
    elif close_signal(db, signal, outcome, exit_price=exit_px, close_reason=reason):
        await close_signal_copies(db, signal)
    return signal.status != "active"


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
    await close_signal_copies(db, signal)
    if getattr(signal, "is_cult_candidate", False):
        return
    ids = subscriber_ids_for_notify(db)
    num = signal.number if signal.number is not None else signal.id
    if not ids:
        logger.warning("Close push #%s: нет получателей (notify_enabled + подписка)", num)
        return
    delivered = await notify_subscribers(
        format_closed_signal_message(signal, market_close=market_close),
        ids,
        direction=signal.direction,
    )
    if delivered == 0:
        logger.warning("Close push #%s: ни одному из %s подписчиков не доставлено", num, len(ids))
    else:
        logger.info("Close push #%s → %s/%s подписчиков", num, delivered, len(ids))


async def close_signal_at_market(db: Session, signal: Signal, *, notify: bool = True) -> None:
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
        stop_loss=signal.stop_loss,
        take_profits=signal.take_profits,
        published_market_price=signal.published_market_price,
    )
    outcome = outcome_from_move(move)
    if notify:
        await close_signal_and_notify(db, signal, outcome, exit_price=exit_price, market_close=True)
    elif not close_signal(db, signal, outcome, exit_price=exit_price, close_reason="market"):
        raise ValueError("close_failed")
    else:
        await close_signal_copies(db, signal)
    if signal.status == "active":
        raise ValueError("close_failed")


async def notify_market_closed(signal_id: int) -> None:
    """Telegram-уведомление после ручного закрытия (отдельная сессия, не блокирует API)."""
    db = SessionLocal()
    try:
        signal = db.get(Signal, signal_id)
        if signal is None or signal.status == "active":
            return
        ids = subscriber_ids_for_notify(db)
        if ids:
            await notify_subscribers(
                format_closed_signal_message(signal, market_close=True),
                ids,
                direction=signal.direction,
            )
    except Exception:
        logger.exception("notify market close failed for signal #%s", signal_id)
    finally:
        db.close()


async def notify_entry_filled_if_needed(db: Session, signal: Signal) -> bool:
    """Push «В РЫНКЕ» один раз после срабатывания лимитки."""
    if signal.entry_filled_at is None or signal.entry_notified_at is not None:
        return False
    num = signal.number if signal.number is not None else signal.id
    ids = subscriber_ids_for_notify(db)
    if not ids:
        logger.warning("Entry push #%s: нет получателей (notify_enabled + подписка)", num)
        return False
    delivered = await notify_subscribers(
        format_entry_filled_message(signal),
        ids,
        direction=signal.direction,
    )
    if delivered == 0:
        logger.warning(
            "Entry push #%s: ни одному из %s подписчиков не доставлено — повторим в мониторе",
            num,
            len(ids),
        )
        return False
    signal.entry_notified_at = datetime.now(timezone.utc)
    db.commit()
    logger.info("Entry push #%s → %s/%s подписчиков", num, delivered, len(ids))
    return True


async def after_limit_entry_filled(db: Session, signal: Signal, *, notify: bool = True) -> None:
    """После entry_filled_at: Telegram push и копии на Bybit."""
    if getattr(signal, "is_cult_candidate", False):
        try:
            await open_signal_copy_for_user(db, signal, signal.author_telegram_id)
        except Exception:
            logger.exception("CULT copy open failed for signal #%s", signal.id)
        return
    if notify:
        try:
            await notify_entry_filled_if_needed(db, signal)
        except Exception:
            logger.exception("Entry notify failed for signal #%s", signal.id)
    try:
        await open_signal_copies(db, signal)
    except Exception:
        logger.exception("open_signal_copies failed for signal #%s", signal.id)


async def notify_entry_filled(db: Session, signal: Signal) -> None:
    await notify_entry_filled_if_needed(db, signal)


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
            direction=signal.direction,
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

    if (
        not entry_zone_defined(signal.entry_low, signal.entry_high)
        and signal.published_market_price is not None
        and signal.published_market_price > 0
    ):
        signal.points_percent = compute_signal_points_percent_from_price(
            float(signal.published_market_price),
            signal.stop_loss,
        )

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

    if quotes and await try_close_on_quotes(db, signal, quotes):
        logger.info(
            "Публикация signal #%s %s: закрыт по стопу/цели (цена уже за уровнем)",
            signal.id,
            signal.symbol,
        )
        return

    if getattr(signal, "is_cult_candidate", False):
        if signal.entry_filled_at is not None:
            await open_signal_copy_for_user(db, signal, signal.author_telegram_id)
        return

    try:
        await open_signal_copies(db, signal, at_publication=True)
    except Exception:
        logger.exception("open_signal_copies at publication failed for signal #%s", signal.id)

    if signal.entry_filled_at is not None:
        await after_limit_entry_filled(db, signal, notify=notify_entry and entry_hit is not None)
    elif entry_zone_defined(signal.entry_low, signal.entry_high):
        logger.info(
            "Публикация signal #%s %s: лимитный вход сигнала, копии volnovoi открыты по рынку",
            signal.id,
            signal.symbol,
        )


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
    if getattr(signal, "is_cult_candidate", False):
        await open_signal_copy_for_user(db, signal, signal.author_telegram_id)
    else:
        await after_limit_entry_filled(db, signal, notify=notify)
    refreshed = await fetch_market_quotes(signal.symbol)
    if refreshed:
        await try_close_on_quotes(db, signal, refreshed)
    return True


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
    account_size: float | None = None,
    author_first_name: str | None = None,
    author_last_name: str | None = None,
    is_cult_candidate: bool = False,
) -> Signal:
    stop_pts = compute_signal_points_percent(entry_low, entry_high, stop_loss)
    stake = risk_percent if risk_percent is not None else DEFAULT_ENTRY_STAKE_PCT
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
        points_percent=stop_pts,
        leverage=leverage,
        risk_percent=stake,
        tracker_balance=tracker_balance,
        account_size=account_size,
        views_count=0,
        likes_count=0,
        author_telegram_id=author_telegram_id,
        author_username=author_username,
        is_cult_candidate=is_cult_candidate,
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
    account_size: float | None = None,
) -> None:
    signal.symbol = symbol
    signal.direction = direction
    signal.entry_low = entry_low
    signal.entry_high = entry_high
    signal.stop_loss = stop_loss
    signal.take_profits = take_profits
    signal.comment = comment
    signal.leverage = leverage
    signal.points_percent = compute_signal_points_percent(entry_low, entry_high, stop_loss)
    if risk_percent is not None:
        signal.risk_percent = risk_percent
    if tracker_balance is not None:
        signal.tracker_balance = tracker_balance
    if account_size is not None:
        signal.account_size = account_size
