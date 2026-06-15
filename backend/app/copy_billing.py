"""Копирование volnovoi: депозит комиссии, 20% прибыли списывается автоматически."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import PaymentTx, SignalCopyTrade, Subscriber, UserBybitSettings
from app.subscription_billing import ensure_payment_memo, usdt_pay_address
from app.ton_payments import TonPaymentCheck, TonPaymentError, verify_usdt_ton_payment

logger = logging.getLogger(__name__)

COPY_FEE_PERCENT = 20.0
MIN_FEE_USD = 0.01
MIN_COPY_DEPOSIT_USD = 0.01
MIN_TOPUP_USD = 1.0

_COPY_ACTIVITY_STATUSES = ("open", "opening", "closing", "closed")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _require_subscriber(db: Session, telegram_user_id: int) -> Subscriber:
    sub = db.get(Subscriber, telegram_user_id)
    if sub is None:
        raise ValueError("Подписчик не найден")
    return sub


def copy_fee_deposit_usd(sub: Subscriber) -> float:
    return round(max(0.0, float(sub.copy_fee_deposit_usd or 0)), 2)


def usdt_credited_usd(check: TonPaymentCheck) -> float:
    return round(check.amount_raw / 1_000_000, 2)


def copy_baseline_unset(sub: Subscriber) -> bool:
    """База не задана или ошибочно 0 без списаний — весь баланс нельзя считать прибылью."""
    billed = float(sub.copy_billed_profit_usd or 0)
    baseline = sub.copy_equity_baseline_usd
    if baseline is None:
        return True
    return baseline <= 0 and billed == 0


def profit_since_connect(current_equity: float | None, sub: Subscriber) -> float:
    if current_equity is None or copy_baseline_unset(sub):
        return 0.0
    return round(max(0.0, float(current_equity) - float(sub.copy_equity_baseline_usd)), 2)


def unbilled_profit(current_equity: float | None, sub: Subscriber) -> float:
    total = profit_since_connect(current_equity, sub)
    billed = float(sub.copy_billed_profit_usd or 0)
    return round(max(0.0, total - billed), 2)


def fee_from_profit(profit_usd: float) -> float:
    if profit_usd <= 0:
        return 0.0
    return round(profit_usd * COPY_FEE_PERCENT / 100.0, 2)


def user_has_copy_trades(db: Session, telegram_user_id: int) -> bool:
    count = db.scalar(
        select(func.count())
        .select_from(SignalCopyTrade)
        .where(
            SignalCopyTrade.telegram_user_id == telegram_user_id,
            SignalCopyTrade.exchange_status.in_(_COPY_ACTIVITY_STATUSES),
        )
    )
    return int(count or 0) > 0


def sync_copy_baseline_if_no_trades(
    db: Session,
    telegram_user_id: int,
    sub: Subscriber,
    row: UserBybitSettings | None,
    current_equity: float | None,
) -> None:
    """Пока сделок не было — база = текущий баланс, прибыль копирования 0."""
    if current_equity is None or current_equity <= 0:
        return
    if user_has_copy_trades(db, telegram_user_id):
        return
    rounded = round(float(current_equity), 2)
    sub.copy_equity_baseline_usd = rounded
    sub.copy_billed_profit_usd = 0.0
    if row is not None:
        row.equity_baseline_usd = rounded
        row.last_equity_usd = rounded


def copy_fee_exempt(telegram_user_id: int) -> bool:
    return False


def copy_trading_allowed(db: Session, telegram_user_id: int) -> bool:
    sub = db.get(Subscriber, telegram_user_id)
    if sub is None:
        return False
    return copy_fee_deposit_usd(sub) >= MIN_COPY_DEPOSIT_USD


def ensure_baseline_on_connect(
    db: Session,
    sub: Subscriber,
    row: UserBybitSettings | None,
    current_equity: float | None,
) -> None:
    """База прибыли хранится у подписчика — не сбрасывается при удалении/переподключении API."""
    _ = db
    if sub.copy_connected_at is None:
        sub.copy_connected_at = _now()

    if not copy_baseline_unset(sub):
        if row is not None and current_equity is not None:
            row.last_equity_usd = round(float(current_equity), 2)
        return

    baseline: float | None = None
    if row is not None:
        if row.equity_baseline_usd is not None and row.equity_baseline_usd > 0:
            baseline = float(row.equity_baseline_usd)
        elif row.last_equity_usd is not None and row.last_equity_usd > 0:
            baseline = float(row.last_equity_usd)
    if baseline is None and current_equity is not None and current_equity > 0:
        baseline = float(current_equity)

    if baseline is not None and baseline > 0:
        rounded = round(baseline, 2)
        sub.copy_equity_baseline_usd = rounded
        if row is not None:
            row.equity_baseline_usd = rounded

    if row is not None and current_equity is not None:
        row.last_equity_usd = round(float(current_equity), 2)


def settle_copy_fees_from_deposit(
    db: Session,
    telegram_user_id: int,
    row: UserBybitSettings | None,
    current_equity: float | None,
) -> float:
    """Списать до 20% неоплаченной прибыли с депозита. Возвращает остаток депозита."""
    if current_equity is None:
        sub = db.get(Subscriber, telegram_user_id)
        return copy_fee_deposit_usd(sub) if sub is not None else 0.0

    sub = _require_subscriber(db, telegram_user_id)
    if row is not None:
        row.last_equity_usd = round(float(current_equity), 2)

    fee_due = fee_from_profit(unbilled_profit(current_equity, sub))
    if fee_due < MIN_FEE_USD:
        return copy_fee_deposit_usd(sub)

    deposit = copy_fee_deposit_usd(sub)
    deduct = round(min(fee_due, deposit), 2)
    if deduct < MIN_FEE_USD:
        return deposit

    profit_billed = round(deduct / (COPY_FEE_PERCENT / 100.0), 2)
    sub.copy_billed_profit_usd = round(float(sub.copy_billed_profit_usd or 0) + profit_billed, 2)
    sub.copy_fee_deposit_usd = round(deposit - deduct, 2)
    logger.info(
        "Copy fee debit user=%s fee=$%.2f profit_billed=$%.2f deposit_left=$%.2f",
        telegram_user_id,
        deduct,
        profit_billed,
        sub.copy_fee_deposit_usd,
    )
    return copy_fee_deposit_usd(sub)


def record_copy_deposit_topup(db: Session, telegram_user_id: int, tx_id: str) -> float:
    sub = _require_subscriber(db, telegram_user_id)
    memo = ensure_payment_memo(db, sub)

    try:
        check = verify_usdt_ton_payment(tx_id, MIN_TOPUP_USD, expected_memo=memo)
    except TonPaymentError as e:
        raise ValueError(str(e)) from e

    if db.scalar(select(PaymentTx.id).where(PaymentTx.tx_id == check.tx_hash_hex)):
        raise ValueError("Этот TXID уже зарегистрирован")

    credit = usdt_credited_usd(check)
    if credit < MIN_TOPUP_USD:
        raise ValueError(f"Минимальное пополнение — ${MIN_TOPUP_USD:g}")

    sub.copy_fee_deposit_usd = round(copy_fee_deposit_usd(sub) + credit, 2)
    db.add(
        PaymentTx(
            telegram_user_id=telegram_user_id,
            tx_id=check.tx_hash_hex,
            plan="copy_deposit",
            amount_usd=credit,
        )
    )
    db.flush()
    return copy_fee_deposit_usd(sub)


def billing_snapshot(
    db: Session,
    telegram_user_id: int,
    row: UserBybitSettings | None,
    *,
    current_equity: float | None = None,
) -> dict[str, object]:
    sub = db.get(Subscriber, telegram_user_id)
    last_equity = row.last_equity_usd if row is not None else None
    equity = current_equity if current_equity is not None else last_equity

    if sub is None:
        return {
            "usdt_ton_address": usdt_pay_address(),
            "fee_percent": COPY_FEE_PERCENT,
            "min_topup_usd": MIN_TOPUP_USD,
            "fee_deposit_usd": 0.0,
            "connected_at": None,
            "equity_baseline_usd": None,
            "current_equity_usd": equity,
            "profit_usd": 0.0,
            "unbilled_profit_usd": 0.0,
            "accrued_fee_usd": 0.0,
            "copy_allowed": copy_trading_allowed(db, telegram_user_id),
            "fee_exempt": False,
        }

    if row is not None and current_equity is not None:
        row.last_equity_usd = round(float(current_equity), 2)
        equity = current_equity

    if user_has_copy_trades(db, telegram_user_id):
        profit = profit_since_connect(equity, sub)
        unbilled = unbilled_profit(equity, sub)
    else:
        profit = 0.0
        unbilled = 0.0
    accrued_fee = fee_from_profit(unbilled)
    deposit = copy_fee_deposit_usd(sub)

    return {
        "usdt_ton_address": usdt_pay_address(),
        "fee_percent": COPY_FEE_PERCENT,
        "min_topup_usd": MIN_TOPUP_USD,
        "fee_deposit_usd": deposit,
        "connected_at": sub.copy_connected_at.isoformat() if sub.copy_connected_at else None,
        "equity_baseline_usd": sub.copy_equity_baseline_usd,
        "current_equity_usd": equity,
        "profit_usd": profit,
        "unbilled_profit_usd": unbilled,
        "accrued_fee_usd": accrued_fee,
        "copy_allowed": copy_trading_allowed(db, telegram_user_id),
        "fee_exempt": False,
    }
