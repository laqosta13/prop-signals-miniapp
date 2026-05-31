"""API настроек копирования сигналов на Bybit."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.bybit_trading import BybitCredentials, get_wallet_usdt_balance
from app.copy_billing import (
    billing_snapshot,
    copy_trading_allowed,
    ensure_baseline_on_connect,
    record_copy_fee_payment,
    upsert_daily_invoice,
)
from app.credentials_crypto import decrypt_secret, encrypt_secret
from app.deps import db_session, get_current_user
from app.models import UserBybitSettings
from app.schemas import TelegramUser

router = APIRouter(prefix="/copy-trading", tags=["copy-trading"])


class CopyInvoiceRead(BaseModel):
    id: int
    period_date: str
    profit_usd: float
    fee_usd: float
    created_at: str | None = None


class CopyTradingStatusRead(BaseModel):
    configured: bool
    enabled: bool = False
    testnet: bool = True
    api_key_hint: str | None = None
    account_balance_usd: float = 10_000.0
    stake_percent: float = 10.0
    usdt_balance: float | None = None
    balance_error: str | None = None
    usdt_ton_address: str = ""
    fee_percent: float = 20.0
    connected_at: str | None = None
    equity_baseline_usd: float | None = None
    current_equity_usd: float | None = None
    profit_usd: float = 0.0
    unbilled_profit_usd: float = 0.0
    copy_allowed: bool = True
    pending_invoice: CopyInvoiceRead | None = None


class CopyTradingSaveBody(BaseModel):
    api_key: str = Field(min_length=8, max_length=128)
    api_secret: str = Field(min_length=8, max_length=128)
    testnet: bool = True
    enabled: bool = True
    account_balance_usd: float | None = Field(default=None, ge=100, le=10_000_000)
    stake_percent: float = Field(default=10.0, ge=0.1, le=100)


def _sync_deposit_from_balance(row: UserBybitSettings, balance: float | None) -> None:
    if balance is not None and balance > 0:
        row.account_balance_usd = round(balance, 2)
        row.last_equity_usd = round(balance, 2)


class CopyTradingPatchBody(BaseModel):
    enabled: bool | None = None
    testnet: bool | None = None
    account_balance_usd: float | None = Field(default=None, ge=100, le=10_000_000)
    stake_percent: float | None = Field(default=None, ge=0.1, le=100)


class CopyFeePayBody(BaseModel):
    invoice_id: int
    tx_id: str = Field(min_length=8, max_length=128)


def _credentials_from_row(row: UserBybitSettings) -> BybitCredentials:
    return BybitCredentials(
        api_key=decrypt_secret(row.api_key_encrypted),
        api_secret=decrypt_secret(row.api_secret_encrypted),
        testnet=bool(row.testnet),
    )


def _api_key_hint(row: UserBybitSettings) -> str | None:
    try:
        key = decrypt_secret(row.api_key_encrypted)
        return f"{key[:4]}…{key[-4:]}" if len(key) >= 8 else "••••"
    except ValueError:
        return "ошибка ключа"


async def _fetch_balance(row: UserBybitSettings) -> tuple[float | None, str | None]:
    try:
        return await get_wallet_usdt_balance(_credentials_from_row(row)), None
    except Exception as e:
        return None, str(e)[:200]


def _build_status(
    db: Session,
    row: UserBybitSettings | None,
    *,
    balance: float | None = None,
    balance_error: str | None = None,
) -> CopyTradingStatusRead:
    snap = billing_snapshot(db, row, current_equity=balance)
    pending = snap.get("pending_invoice")
    pending_read = CopyInvoiceRead(**pending) if isinstance(pending, dict) else None

    if row is None:
        return CopyTradingStatusRead(
            configured=False,
            usdt_ton_address=str(snap["usdt_ton_address"]),
            fee_percent=float(snap["fee_percent"]),
            connected_at=None,
            equity_baseline_usd=None,
            current_equity_usd=None,
            profit_usd=0.0,
            unbilled_profit_usd=0.0,
            copy_allowed=True,
            pending_invoice=None,
        )

    return CopyTradingStatusRead(
        configured=True,
        enabled=bool(row.enabled),
        testnet=bool(row.testnet),
        api_key_hint=_api_key_hint(row),
        account_balance_usd=float(row.account_balance_usd),
        stake_percent=float(row.stake_percent),
        usdt_balance=balance,
        balance_error=balance_error,
        usdt_ton_address=str(snap["usdt_ton_address"]),
        fee_percent=float(snap["fee_percent"]),
        connected_at=snap["connected_at"] if isinstance(snap["connected_at"], str) else None,
        equity_baseline_usd=snap["equity_baseline_usd"] if isinstance(snap["equity_baseline_usd"], (int, float)) else None,
        current_equity_usd=snap["current_equity_usd"] if isinstance(snap["current_equity_usd"], (int, float)) else None,
        profit_usd=float(snap["profit_usd"]),
        unbilled_profit_usd=float(snap["unbilled_profit_usd"]),
        copy_allowed=bool(snap["copy_allowed"]),
        pending_invoice=pending_read,
    )


@router.get("/me", response_model=CopyTradingStatusRead)
async def get_my_copy_trading(
    user: TelegramUser = Depends(get_current_user),
    db: Session = Depends(db_session),
) -> CopyTradingStatusRead:
    row = db.get(UserBybitSettings, user.telegram_user_id)
    if row is None:
        return _build_status(db, None)
    balance, balance_error = await _fetch_balance(row)
    _sync_deposit_from_balance(row, balance)
    ensure_baseline_on_connect(row, balance)
    upsert_daily_invoice(db, row, balance)
    db.commit()
    return _build_status(db, row, balance=balance, balance_error=balance_error)


@router.put("/me", response_model=CopyTradingStatusRead)
async def save_my_copy_trading(
    body: CopyTradingSaveBody,
    user: TelegramUser = Depends(get_current_user),
    db: Session = Depends(db_session),
) -> CopyTradingStatusRead:
    row = db.get(UserBybitSettings, user.telegram_user_id)
    is_new = row is None
    if row is None:
        row = UserBybitSettings(
            telegram_user_id=user.telegram_user_id,
            api_key_encrypted=encrypt_secret(body.api_key.strip()),
            api_secret_encrypted=encrypt_secret(body.api_secret.strip()),
        )
        db.add(row)
    else:
        row.api_key_encrypted = encrypt_secret(body.api_key.strip())
        row.api_secret_encrypted = encrypt_secret(body.api_secret.strip())

    row.enabled = body.enabled
    row.testnet = body.testnet
    row.stake_percent = round(body.stake_percent, 2)
    db.flush()

    balance, balance_error = await _fetch_balance(row)
    _sync_deposit_from_balance(row, balance)
    if balance is None and body.account_balance_usd is not None:
        row.account_balance_usd = round(body.account_balance_usd, 2)
    if is_new or row.equity_baseline_usd is None:
        ensure_baseline_on_connect(row, balance)
    upsert_daily_invoice(db, row, balance)
    db.commit()
    db.refresh(row)
    return _build_status(db, row, balance=balance, balance_error=balance_error)


@router.patch("/me", response_model=CopyTradingStatusRead)
async def patch_my_copy_trading(
    body: CopyTradingPatchBody,
    user: TelegramUser = Depends(get_current_user),
    db: Session = Depends(db_session),
) -> CopyTradingStatusRead:
    row = db.get(UserBybitSettings, user.telegram_user_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API не настроен")
    if body.enabled is not None:
        row.enabled = body.enabled
    if body.testnet is not None:
        row.testnet = body.testnet
    if body.stake_percent is not None:
        row.stake_percent = round(body.stake_percent, 2)
    balance, balance_error = await _fetch_balance(row)
    _sync_deposit_from_balance(row, balance)
    if body.account_balance_usd is not None and (balance is None or balance <= 0):
        row.account_balance_usd = round(body.account_balance_usd, 2)
    db.commit()
    db.refresh(row)
    return _build_status(db, row, balance=balance, balance_error=balance_error)


@router.delete("/me")
def delete_my_copy_trading(
    user: TelegramUser = Depends(get_current_user),
    db: Session = Depends(db_session),
) -> dict[str, bool]:
    row = db.get(UserBybitSettings, user.telegram_user_id)
    if row is not None:
        db.delete(row)
        db.commit()
    return {"ok": True}


@router.post("/me/test", response_model=CopyTradingStatusRead)
async def test_my_copy_trading(
    user: TelegramUser = Depends(get_current_user),
    db: Session = Depends(db_session),
) -> CopyTradingStatusRead:
    row = db.get(UserBybitSettings, user.telegram_user_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Сначала сохраните API-ключи")
    balance, balance_error = await _fetch_balance(row)
    if balance_error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Не удалось подключиться к Bybit: {balance_error}",
        )
    _sync_deposit_from_balance(row, balance)
    ensure_baseline_on_connect(row, balance)
    db.commit()
    return _build_status(db, row, balance=balance)


@router.post("/me/pay", response_model=CopyTradingStatusRead)
async def pay_copy_fee(
    body: CopyFeePayBody,
    user: TelegramUser = Depends(get_current_user),
    db: Session = Depends(db_session),
) -> CopyTradingStatusRead:
    row = db.get(UserBybitSettings, user.telegram_user_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API не настроен")
    try:
        record_copy_fee_payment(db, user.telegram_user_id, body.invoice_id, body.tx_id.strip())
        db.commit()
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    db.refresh(row)
    balance, balance_error = await _fetch_balance(row)
    return _build_status(db, row, balance=balance, balance_error=balance_error)
