"""Оплата копирования volnovoi: 20% от прироста прибыли с момента подключения."""

from __future__ import annotations

import logging
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import CopyTradingInvoice, PaymentTx, UserBybitSettings
from app.subscription_billing import usdt_pay_address
from app.ton_payments import TonPaymentError, verify_usdt_ton_payment

logger = logging.getLogger(__name__)

COPY_FEE_PERCENT = 20.0
MIN_FEE_USD = 0.01


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _today() -> date:
    return _now().date()


def profit_since_connect(current_equity: float | None, row: UserBybitSettings) -> float:
    if current_equity is None or row.equity_baseline_usd is None:
        return 0.0
    return round(max(0.0, float(current_equity) - float(row.equity_baseline_usd)), 2)


def unbilled_profit(current_equity: float | None, row: UserBybitSettings) -> float:
    total = profit_since_connect(current_equity, row)
    billed = float(row.billed_profit_usd or 0)
    return round(max(0.0, total - billed), 2)


def fee_from_profit(profit_usd: float) -> float:
    if profit_usd <= 0:
        return 0.0
    return round(profit_usd * COPY_FEE_PERCENT / 100.0, 2)


def has_unpaid_copy_invoice(db: Session, telegram_user_id: int) -> bool:
    if telegram_user_id in settings.admin_id_set:
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
    if telegram_user_id in settings.admin_id_set:
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


def ensure_baseline_on_connect(row: UserBybitSettings, current_equity: float | None) -> None:
    if row.connected_at is None:
        row.connected_at = _now()
    if row.equity_baseline_usd is None and current_equity is not None and current_equity >= 0:
        row.equity_baseline_usd = round(float(current_equity), 2)
    if current_equity is not None:
        row.last_equity_usd = round(float(current_equity), 2)


def upsert_daily_invoice(db: Session, row: UserBybitSettings, current_equity: float | None) -> CopyTradingInvoice | None:
    """Раз в сутки: счёт 20% от неоплаченной прибыли с момента подключения."""
    if row.telegram_user_id in settings.admin_id_set:
        return None
    if current_equity is None:
        return None

    row.last_equity_usd = round(float(current_equity), 2)
    profit = unbilled_profit(current_equity, row)
    fee = fee_from_profit(profit)
    if fee < MIN_FEE_USD:
        return None

    today = _today()
    inv = pending_invoice(db, row.telegram_user_id)
    if inv is not None and inv.period_date == today:
        inv.profit_usd = profit
        inv.fee_usd = fee
        return inv
    if inv is not None and inv.period_date != today:
        return inv

    inv = CopyTradingInvoice(
        telegram_user_id=row.telegram_user_id,
        period_date=today,
        profit_usd=profit,
        fee_usd=fee,
        status="pending",
    )
    db.add(inv)
    db.flush()
    logger.info(
        "Copy invoice user=%s profit=$%.2f fee=$%.2f",
        row.telegram_user_id,
        profit,
        fee,
    )
    return inv


def record_copy_fee_payment(db: Session, telegram_user_id: int, invoice_id: int, tx_id: str) -> CopyTradingInvoice:
    inv = db.get(CopyTradingInvoice, invoice_id)
    if inv is None or inv.telegram_user_id != telegram_user_id:
        raise ValueError("Счёт не найден")
    if inv.status == "paid":
        raise ValueError("Счёт уже оплачен")
    if inv.fee_usd < MIN_FEE_USD:
        raise ValueError("Сумма счёта некорректна")

    try:
        check = verify_usdt_ton_payment(tx_id, inv.fee_usd)
    except TonPaymentError as e:
        raise ValueError(str(e)) from e

    if db.scalar(select(PaymentTx.id).where(PaymentTx.tx_id == check.tx_hash_hex)):
        raise ValueError("Этот TXID уже зарегистрирован")

    settings_row = db.get(UserBybitSettings, telegram_user_id)
    if settings_row is None:
        raise ValueError("API Bybit не настроен")

    inv.status = "paid"
    inv.paid_at = _now()
    inv.tx_id = check.tx_hash_hex
    settings_row.billed_profit_usd = round(float(settings_row.billed_profit_usd or 0) + float(inv.profit_usd), 2)

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
    current_equity: float | None = None,
) -> dict[str, object]:
    if row is None:
        return {
            "usdt_ton_address": usdt_pay_address(),
            "fee_percent": COPY_FEE_PERCENT,
            "connected_at": None,
            "equity_baseline_usd": None,
            "current_equity_usd": None,
            "profit_usd": 0.0,
            "unbilled_profit_usd": 0.0,
            "copy_allowed": True,
            "pending_invoice": None,
        }

    if current_equity is not None:
        row.last_equity_usd = round(float(current_equity), 2)

    profit = profit_since_connect(current_equity if current_equity is not None else row.last_equity_usd, row)
    unbilled = unbilled_profit(current_equity if current_equity is not None else row.last_equity_usd, row)
    inv = pending_invoice(db, row.telegram_user_id)
    allowed = copy_trading_allowed(db, row.telegram_user_id)

    pending_data = None
    if inv is not None and inv.status == "pending" and inv.fee_usd >= MIN_FEE_USD:
        pending_data = {
            "id": inv.id,
            "period_date": inv.period_date.isoformat(),
            "profit_usd": inv.profit_usd,
            "fee_usd": inv.fee_usd,
            "created_at": inv.created_at.isoformat() if inv.created_at else None,
        }

    return {
        "usdt_ton_address": usdt_pay_address(),
        "fee_percent": COPY_FEE_PERCENT,
        "connected_at": row.connected_at.isoformat() if row.connected_at else None,
        "equity_baseline_usd": row.equity_baseline_usd,
        "current_equity_usd": current_equity if current_equity is not None else row.last_equity_usd,
        "profit_usd": profit,
        "unbilled_profit_usd": unbilled,
        "copy_allowed": allowed,
        "pending_invoice": pending_data,
    }
