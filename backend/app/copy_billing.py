"""Оплата копирования volnovoi: 20% от прироста прибыли с момента подключения."""

from __future__ import annotations

import logging
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import CopyTradingInvoice, CopyUserBilling, PaymentTx, Subscriber, UserBybitSettings
from app.subscription_billing import ensure_payment_memo, usdt_pay_address
from app.ton_payments import TonPaymentError, verify_usdt_ton_payment

logger = logging.getLogger(__name__)

COPY_FEE_PERCENT = 20.0
MIN_FEE_USD = 0.01


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _today() -> date:
    return _now().date()


def get_or_create_copy_billing(db: Session, telegram_user_id: int) -> CopyUserBilling:
    billing = db.get(CopyUserBilling, telegram_user_id)
    if billing is None:
        billing = CopyUserBilling(telegram_user_id=telegram_user_id)
        db.add(billing)
        db.flush()
    return billing


def hydrate_copy_billing_from_settings(db: Session, row: UserBybitSettings | None) -> CopyUserBilling | None:
    if row is None:
        return None
    billing = get_or_create_copy_billing(db, row.telegram_user_id)
    if billing.equity_baseline_usd is None and row.equity_baseline_usd is not None:
        billing.equity_baseline_usd = float(row.equity_baseline_usd)
    if billing.connected_at is None and row.connected_at is not None:
        billing.connected_at = row.connected_at
    if float(billing.billed_profit_usd or 0) <= 0 and float(row.billed_profit_usd or 0) > 0:
        billing.billed_profit_usd = float(row.billed_profit_usd)
    return billing


def profit_since_connect(current_equity: float | None, billing: CopyUserBilling) -> float:
    if current_equity is None or billing.equity_baseline_usd is None:
        return 0.0
    return round(max(0.0, float(current_equity) - float(billing.equity_baseline_usd)), 2)


def unbilled_profit(current_equity: float | None, billing: CopyUserBilling) -> float:
    total = profit_since_connect(current_equity, billing)
    billed = float(billing.billed_profit_usd or 0)
    return round(max(0.0, total - billed), 2)


def fee_from_profit(profit_usd: float) -> float:
    if profit_usd <= 0:
        return 0.0
    return round(profit_usd * COPY_FEE_PERCENT / 100.0, 2)


def has_unpaid_copy_invoice(db: Session, telegram_user_id: int) -> bool:
    if telegram_user_id in settings.all_admin_id_set:
        return False
    inv = db.scalar(
        select(CopyTradingInvoice)
        .where(
            CopyTradingInvoice.telegram_user_id == telegram_user_id,
            CopyTradingInvoice.status == "pending",
            CopyTradingInvoice.fee_usd >= MIN_FEE_USD,
        )
        .order_by(CopyTradingInvoice.created_at.desc())
        .limit(1)
    )
    return inv is not None


def copy_trading_allowed(db: Session, telegram_user_id: int) -> bool:
    if telegram_user_id in settings.all_admin_id_set:
        return True
    return not has_unpaid_copy_invoice(db, telegram_user_id)


def pending_invoice(db: Session, telegram_user_id: int) -> CopyTradingInvoice | None:
    return db.scalar(
        select(CopyTradingInvoice)
        .where(
            CopyTradingInvoice.telegram_user_id == telegram_user_id,
            CopyTradingInvoice.status == "pending",
        )
        .order_by(CopyTradingInvoice.created_at.desc())
        .limit(1)
    )


def ensure_baseline_on_connect(
    billing: CopyUserBilling,
    current_equity: float | None,
    *,
    settings_row: UserBybitSettings | None = None,
) -> None:
    if billing.connected_at is None:
        billing.connected_at = _now()
    if billing.equity_baseline_usd is None and current_equity is not None and current_equity >= 0:
        billing.equity_baseline_usd = round(float(current_equity), 2)
    if settings_row is not None and current_equity is not None:
        settings_row.last_equity_usd = round(float(current_equity), 2)
        if settings_row.connected_at is None:
            settings_row.connected_at = billing.connected_at
        if settings_row.equity_baseline_usd is None:
            settings_row.equity_baseline_usd = billing.equity_baseline_usd


def upsert_daily_invoice(
    db: Session,
    telegram_user_id: int,
    current_equity: float | None,
    *,
    settings_row: UserBybitSettings | None = None,
) -> CopyTradingInvoice | None:
    """Счёт 20% от неоплаченной прибыли с момента первого подключения."""
    if telegram_user_id in settings.all_admin_id_set:
        return None
    if current_equity is None:
        return None

    billing = hydrate_copy_billing_from_settings(db, settings_row) or get_or_create_copy_billing(
        db, telegram_user_id
    )
    if settings_row is not None:
        settings_row.last_equity_usd = round(float(current_equity), 2)

    profit = unbilled_profit(current_equity, billing)
    fee = fee_from_profit(profit)
    if fee < MIN_FEE_USD:
        return None

    today = _today()
    inv = pending_invoice(db, telegram_user_id)
    if inv is not None and inv.period_date == today:
        inv.profit_usd = profit
        inv.fee_usd = fee
        return inv
    if inv is not None and inv.period_date != today:
        return inv

    inv = CopyTradingInvoice(
        telegram_user_id=telegram_user_id,
        period_date=today,
        profit_usd=profit,
        fee_usd=fee,
        status="pending",
    )
    db.add(inv)
    db.flush()
    logger.info("Copy invoice user=%s profit=$%.2f fee=$%.2f", telegram_user_id, profit, fee)
    return inv


def record_copy_fee_payment(db: Session, telegram_user_id: int, invoice_id: int, tx_id: str) -> CopyTradingInvoice:
    inv = db.get(CopyTradingInvoice, invoice_id)
    if inv is None or inv.telegram_user_id != telegram_user_id:
        raise ValueError("Счёт не найден")
    if inv.status == "paid":
        raise ValueError("Счёт уже оплачен")
    if inv.fee_usd < MIN_FEE_USD:
        raise ValueError("Сумма счёта некорректна")

    sub = db.get(Subscriber, telegram_user_id)
    if sub is None:
        raise ValueError("Подписчик не найден")
    memo = ensure_payment_memo(db, sub)

    try:
        check = verify_usdt_ton_payment(tx_id, inv.fee_usd, expected_memo=memo)
    except TonPaymentError as e:
        raise ValueError(str(e)) from e

    if db.scalar(select(PaymentTx.id).where(PaymentTx.tx_id == check.tx_hash_hex)):
        raise ValueError("Этот TXID уже зарегистрирован")

    settings_row = db.get(UserBybitSettings, telegram_user_id)
    billing = hydrate_copy_billing_from_settings(db, settings_row) or get_or_create_copy_billing(
        db, telegram_user_id
    )

    inv.status = "paid"
    inv.paid_at = _now()
    inv.tx_id = check.tx_hash_hex
    billing.billed_profit_usd = round(float(billing.billed_profit_usd or 0) + float(inv.profit_usd), 2)
    if settings_row is not None:
        settings_row.billed_profit_usd = billing.billed_profit_usd

    db.add(
        PaymentTx(
            telegram_user_id=telegram_user_id,
            tx_id=check.tx_hash_hex,
            plan="copy_fee",
            amount_usd=inv.fee_usd,
        )
    )
    db.flush()
    return inv


def billing_snapshot(
    db: Session,
    row: UserBybitSettings | None,
    *,
    telegram_user_id: int | None = None,
    current_equity: float | None = None,
) -> dict[str, object]:
    tid = telegram_user_id or (row.telegram_user_id if row is not None else None)
    allowed = copy_trading_allowed(db, tid) if tid is not None else True
    inv = pending_invoice(db, tid) if tid is not None else None

    pending_data = None
    if inv is not None and inv.status == "pending" and inv.fee_usd >= MIN_FEE_USD:
        pending_data = {
            "id": inv.id,
            "period_date": inv.period_date.isoformat(),
            "profit_usd": inv.profit_usd,
            "fee_usd": inv.fee_usd,
            "created_at": inv.created_at.isoformat() if inv.created_at else None,
        }

    payment_memo = ""
    if tid is not None:
        sub = db.get(Subscriber, tid)
        if sub is not None:
            payment_memo = ensure_payment_memo(db, sub)

    if row is None:
        return {
            "usdt_ton_address": usdt_pay_address(),
            "payment_memo": payment_memo,
            "fee_percent": COPY_FEE_PERCENT,
            "connected_at": None,
            "equity_baseline_usd": None,
            "current_equity_usd": None,
            "profit_usd": 0.0,
            "unbilled_profit_usd": 0.0,
            "copy_allowed": allowed,
            "pending_invoice": pending_data,
        }

    billing = hydrate_copy_billing_from_settings(db, row) or get_or_create_copy_billing(db, row.telegram_user_id)
    if current_equity is not None:
        row.last_equity_usd = round(float(current_equity), 2)

    equity = current_equity if current_equity is not None else row.last_equity_usd
    profit = profit_since_connect(equity, billing)
    unbilled = unbilled_profit(equity, billing)

    return {
        "usdt_ton_address": usdt_pay_address(),
        "payment_memo": payment_memo,
        "fee_percent": COPY_FEE_PERCENT,
        "connected_at": billing.connected_at.isoformat() if billing.connected_at else None,
        "equity_baseline_usd": billing.equity_baseline_usd,
        "current_equity_usd": equity,
        "profit_usd": profit,
        "unbilled_profit_usd": unbilled,
        "copy_allowed": allowed,
        "pending_invoice": pending_data,
    }
