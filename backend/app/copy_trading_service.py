"""Копирование сигналов volnovoi на Bybit каждого подписчика."""

from __future__ import annotations

import logging
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


def _mark_copy_failed(db: Session, row: SignalCopyTrade, error: str) -> None:
    row.exchange_status = EXCHANGE_FAILED
    row.exchange_error = error[:500]
    db.commit()


async def _open_copy_for_user(db: Session, signal: Signal, user_row: UserBybitSettings) -> None:
    copy_row = _get_or_create_copy_row(db, signal.id, user_row.telegram_user_id)
    if copy_row.exchange_status in (EXCHANGE_OPEN, EXCHANGE_OPENING, EXCHANGE_CLOSED, EXCHANGE_CLOSING):
        return
    if copy_row.exchange_status == EXCHANGE_SKIPPED:
        return

    pair = bybit_linear_pair(signal.symbol)
    if not pair:
        copy_row.exchange_status = EXCHANGE_SKIPPED
        copy_row.exchange_error = "не USDT perpetual"
        db.commit()
        return

    entry_price = signal_entry_price(signal)
    if entry_price is None or entry_price <= 0:
        quote = await fetch_bybit_perp_quote(signal.symbol)
        if quote is not None and quote.price > 0:
            entry_price = float(quote.price)
    if entry_price is None or entry_price <= 0:
        _mark_copy_failed(db, copy_row, "нет цены входа")
        return

    notional = copy_notional_usd(user_row, signal)
    copy_row.exchange_status = EXCHANGE_OPENING
    copy_row.exchange_pair = pair
    db.commit()

    creds = _user_credentials(user_row)
    uid = user_row.telegram_user_id
    try:
        rules = await get_instrument_rules(creds, pair)
        qty = calc_qty(notional, entry_price, rules)
        if qty is None:
            _mark_copy_failed(db, copy_row, f"qty слишком мала (${notional:.2f})")
            return

        await set_leverage(creds, pair, signal_leverage(signal))
        side = _side_for_direction(signal.direction)
        order_id = await place_market_entry(
            creds,
            pair=pair,
            side=side,
            qty=qty,
            order_link_id=f"ps-u{uid}-s{signal.id}-in",
        )

        stop = parse_price(signal.stop_loss)
        tp = _first_take_profit(signal)
        try:
            await set_position_stops(creds, pair=pair, stop_loss=stop, take_profit=tp)
        except Exception as e:
            logger.warning("Bybit copy SL/TP user=%s signal #%s: %s", uid, signal.id, e)

        copy_row.exchange_status = EXCHANGE_OPEN
        copy_row.exchange_qty = float(qty)
        copy_row.exchange_order_id = order_id
        copy_row.exchange_error = None
        db.commit()
        logger.info("Bybit copy: user=%s signal #%s %s qty=%s", uid, signal.id, pair, qty)
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
            order_link_id=f"ps-u{uid}-s{signal.id}-out",
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


async def open_signal_copy_for_user(db: Session, signal: Signal, telegram_user_id: int) -> None:
    """Открыть сделку на Bybit только у указанного пользователя (кандидат CULT)."""
    if signal.entry_filled_at is None or signal.status != "active":
        return
    row = db.get(UserBybitSettings, telegram_user_id)
    if row is None or not row.enabled:
        return
    await _open_copy_for_user(db, signal, row)


async def open_signal_copies(db: Session, signal: Signal) -> None:
    """Открыть копии сигнала на Bybit у всех подписчиков с API."""
    if getattr(signal, "is_cult_candidate", False):
        return
    if signal.entry_filled_at is None or signal.status != "active":
        return
    users = eligible_copy_settings(db)
    if not users:
        return
    for user_row in users:
        await _open_copy_for_user(db, signal, user_row)


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
