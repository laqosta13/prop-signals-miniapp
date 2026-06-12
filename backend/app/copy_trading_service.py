"""Копирование сигналов volnovoi на Bybit каждого подписчика."""

from __future__ import annotations

import logging
import time
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.bybit_trading import (
    BybitCredentials,
    calc_qty,
    close_position_market,
    get_instrument_rules,
    place_market_entry,
    set_leverage,
    set_position_stops,
)
from app.credentials_crypto import decrypt_secret
from app.copy_billing import copy_trading_allowed
from app.models import Signal, SignalCopyTrade, UserBybitSettings
from app.price_service import bybit_linear_pair, fetch_bybit_perp_quote
from app.signal_utils import parse_price, parse_take_profit_levels
from app.trader_stats import signal_entry_price, signal_entry_stake_pct, signal_leverage

logger = logging.getLogger(__name__)

EXCHANGE_SKIPPED = "skipped"
EXCHANGE_OPENING = "opening"
EXCHANGE_OPEN = "open"
EXCHANGE_CLOSING = "closing"
EXCHANGE_CLOSED = "closed"
EXCHANGE_FAILED = "failed"


def _side_for_direction(direction: str) -> str:
    return "Buy" if direction.lower() == "long" else "Sell"


def _close_side_for_direction(direction: str) -> str:
    return "Sell" if direction.lower() == "long" else "Buy"


def _first_take_profit(signal: Signal) -> float | None:
    levels = parse_take_profit_levels(signal.take_profits)
    if not levels:
        return parse_price(signal.take_profits)
    if signal.direction.lower() == "long":
        return min(levels)
    return max(levels)


def _user_credentials(row: UserBybitSettings) -> BybitCredentials:
    return BybitCredentials(
        api_key=decrypt_secret(row.api_key_encrypted),
        api_secret=decrypt_secret(row.api_secret_encrypted),
    )


def copy_deposit_base_usd(settings_row: UserBybitSettings) -> float:
    """База номинала: последний баланс Bybit, иначе сохранённый депозит."""
    if settings_row.last_equity_usd is not None and settings_row.last_equity_usd > 0:
        return float(settings_row.last_equity_usd)
    return max(float(settings_row.account_balance_usd or 0), 0)


def copy_notional_usd(settings_row: UserBybitSettings, signal: Signal) -> float:
    stake = signal_entry_stake_pct(signal)
    lev = signal_leverage(signal)
    base = copy_deposit_base_usd(settings_row)
    custom = float(settings_row.stake_percent or 0)
    if custom > 0:
        stake = custom
    return round(base * stake * lev / 100.0, 2)


def eligible_copy_settings(db: Session) -> list[UserBybitSettings]:
    rows = list(db.scalars(select(UserBybitSettings).where(UserBybitSettings.enabled.is_(True))).all())
    return [row for row in rows if copy_trading_allowed(db, row.telegram_user_id)]


def _copy_open_blocked(copy_row: SignalCopyTrade) -> bool:
    if copy_row.exchange_status in (EXCHANGE_OPEN, EXCHANGE_CLOSED, EXCHANGE_CLOSING):
        return True
    if copy_row.exchange_status == EXCHANGE_SKIPPED:
        return True
    return False


def _order_link_id(copy_row_id: int) -> str:
    return f"ps{copy_row_id}-{int(time.time())}"[:36]


def _get_or_create_copy_row(db: Session, signal_id: int, user_id: int) -> SignalCopyTrade:
    row = db.scalar(
        select(SignalCopyTrade).where(
            SignalCopyTrade.signal_id == signal_id,
            SignalCopyTrade.telegram_user_id == user_id,
        )
    )
    if row is None:
        row = SignalCopyTrade(signal_id=signal_id, telegram_user_id=user_id)
        db.add(row)
        db.flush()
    return row


def recent_copy_errors(db: Session, telegram_user_id: int, limit: int = 3) -> list[str]:
    rows = db.execute(
        select(SignalCopyTrade, Signal.symbol)
        .join(Signal, Signal.id == SignalCopyTrade.signal_id)
        .where(
            SignalCopyTrade.telegram_user_id == telegram_user_id,
            SignalCopyTrade.exchange_status == EXCHANGE_FAILED,
            SignalCopyTrade.exchange_error.isnot(None),
        )
        .order_by(SignalCopyTrade.created_at.desc())
        .limit(limit)
    ).all()
    return [f"{sym}: {row.exchange_error}" for row, sym in rows if row.exchange_error]


def _mark_copy_failed(db: Session, row: SignalCopyTrade, error: str) -> None:
    row.exchange_status = EXCHANGE_FAILED
    row.exchange_error = error[:500]
    db.commit()


async def _resolve_copy_entry_price(signal: Signal, *, at_publication: bool) -> float | None:
    """Цена market-входа копии: при публикации — рынок, после лимитки — зона входа сигнала."""
    if at_publication:
        if signal.published_market_price is not None and signal.published_market_price > 0:
            return float(signal.published_market_price)
        quote = await fetch_bybit_perp_quote(signal.symbol)
        if quote is not None and quote.price > 0:
            return float(quote.price)
        return None

    entry_price = signal_entry_price(signal)
    if entry_price is None or entry_price <= 0:
        quote = await fetch_bybit_perp_quote(signal.symbol)
        if quote is not None and quote.price > 0:
            entry_price = float(quote.price)
    return entry_price if entry_price and entry_price > 0 else None


async def _open_copy_for_user(
    db: Session,
    signal: Signal,
    user_row: UserBybitSettings,
    *,
    at_publication: bool = False,
) -> None:
    copy_row = _get_or_create_copy_row(db, signal.id, user_row.telegram_user_id)
    if _copy_open_blocked(copy_row):
        return

    pair = bybit_linear_pair(signal.symbol)
    if not pair:
        copy_row.exchange_status = EXCHANGE_SKIPPED
        copy_row.exchange_error = "не USDT perpetual"
        db.commit()
        return

    entry_price = await _resolve_copy_entry_price(signal, at_publication=at_publication)
    if entry_price is None:
        _mark_copy_failed(db, copy_row, "нет цены входа")
        return

    notional = copy_notional_usd(user_row, signal)
    copy_row.exchange_status = EXCHANGE_OPENING
    copy_row.exchange_pair = pair
    copy_row.exchange_error = None
    db.commit()

    creds = _user_credentials(user_row)
    uid = user_row.telegram_user_id
    pos_dir = signal.direction
    try:
        rules = await get_instrument_rules(creds, pair)
        qty = calc_qty(notional, entry_price, rules)
        if qty is None:
            hint = f"${notional:.2f}"
            if rules.min_notional > 0:
                hint += f", мин. ордер ${rules.min_notional}"
            _mark_copy_failed(db, copy_row, f"объём слишком мал ({hint})")
            return

        await set_leverage(creds, pair, signal_leverage(signal))
        side = _side_for_direction(signal.direction)
        order_id = await place_market_entry(
            creds,
            pair=pair,
            side=side,
            qty=qty,
            order_link_id=_order_link_id(copy_row.id),
            position_direction=pos_dir,
        )

        stop = parse_price(signal.stop_loss)
        tp = _first_take_profit(signal)
        try:
            await set_position_stops(
                creds,
                pair=pair,
                stop_loss=stop,
                take_profit=tp,
                position_direction=pos_dir,
            )
        except Exception as e:
            logger.warning("Bybit copy SL/TP user=%s signal #%s: %s", uid, signal.id, e)

        copy_row.exchange_status = EXCHANGE_OPEN
        copy_row.exchange_qty = float(qty)
        copy_row.exchange_order_id = order_id
        copy_row.exchange_error = None
        db.commit()
        logger.info(
            "Bybit copy: user=%s signal #%s %s qty=%s%s",
            uid,
            signal.id,
            pair,
            qty,
            " (at publication)" if at_publication else "",
        )
    except Exception as e:
        logger.exception("Bybit copy open user=%s signal #%s", uid, signal.id)
        _mark_copy_failed(db, copy_row, str(e))


async def _close_copy_for_user(db: Session, copy_row: SignalCopyTrade, signal: Signal, creds: BybitCredentials) -> None:
    if copy_row.exchange_status != EXCHANGE_OPEN:
        return
    if not copy_row.exchange_pair or not copy_row.exchange_qty or copy_row.exchange_qty <= 0:
        return

    pair = copy_row.exchange_pair
    qty = Decimal(str(copy_row.exchange_qty))
    uid = copy_row.telegram_user_id
    copy_row.exchange_status = EXCHANGE_CLOSING
    db.commit()

    try:
        side = _close_side_for_direction(signal.direction)
        order_id = await close_position_market(
            creds,
            pair=pair,
            side=side,
            qty=qty,
            order_link_id=_order_link_id(copy_row.id),
            position_direction=signal.direction,
        )
        copy_row.exchange_status = EXCHANGE_CLOSED
        copy_row.exchange_order_id = order_id
        copy_row.exchange_error = None
        db.commit()
        logger.info("Bybit copy close: user=%s signal #%s", uid, signal.id)
    except Exception as e:
        err = str(e).lower()
        if "position" in err or "110017" in err or "110018" in err or "empty" in err:
            copy_row.exchange_status = EXCHANGE_CLOSED
            copy_row.exchange_error = None
            db.commit()
            return
        logger.exception("Bybit copy close user=%s signal #%s", uid, signal.id)
        _mark_copy_failed(db, copy_row, f"close: {e}")


async def sync_open_copies_for_user(db: Session, telegram_user_id: int) -> None:
    """Догоняющее открытие копий активных сделок ленты (volnovoi) для одного подписчика."""
    row = db.get(UserBybitSettings, telegram_user_id)
    if row is None or not row.enabled or not copy_trading_allowed(db, telegram_user_id):
        return
    signals = list(
        db.scalars(
            select(Signal).where(
                Signal.status == "active",
                Signal.is_cult_candidate.is_(False),
            )
        ).all()
    )
    for signal in signals:
        await _open_copy_for_user(db, signal, row, at_publication=True)


async def open_signal_copy_for_user(db: Session, signal: Signal, telegram_user_id: int) -> None:
    if signal.entry_filled_at is None or signal.status != "active":
        return
    row = db.get(UserBybitSettings, telegram_user_id)
    if row is None or not row.enabled:
        return
    await _open_copy_for_user(db, signal, row)


async def open_signal_copies(db: Session, signal: Signal, *, at_publication: bool = False) -> None:
    """Открыть копии сигнала на Bybit у всех подписчиков с API."""
    if getattr(signal, "is_cult_candidate", False):
        return
    if signal.status != "active":
        return
    if not at_publication and signal.entry_filled_at is None:
        return
    users = eligible_copy_settings(db)
    if not users:
        return
    for user_row in users:
        await _open_copy_for_user(db, signal, user_row, at_publication=at_publication)


async def close_signal_copies(db: Session, signal: Signal) -> None:
    """Закрыть копии сигнала на Bybit."""
    copies = list(
        db.scalars(select(SignalCopyTrade).where(SignalCopyTrade.signal_id == signal.id)).all()
    )
    if not copies:
        return
    settings_by_user = {
        r.telegram_user_id: r
        for r in db.scalars(
            select(UserBybitSettings).where(
                UserBybitSettings.telegram_user_id.in_([c.telegram_user_id for c in copies])
            )
        ).all()
    }
    for copy_row in copies:
        user_row = settings_by_user.get(copy_row.telegram_user_id)
        if user_row is None:
            continue
        try:
            creds = _user_credentials(user_row)
        except ValueError:
            continue
        await _close_copy_for_user(db, copy_row, signal, creds)
