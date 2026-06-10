"""API настроек копирования сигналов на Bybit."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.bybit_trading import BybitCredentials, get_wallet_usdt_balance
from app.copy_billing import (
    MIN_TOPUP_USD,
    billing_snapshot,
    copy_trading_allowed,
    ensure_baseline_on_connect,
    record_copy_deposit_topup,
    settle_copy_fees_from_deposit,
)
from app.credentials_crypto import decrypt_secret, encrypt_secret
from app.deps import db_session, get_current_user
from app.models import Subscriber, UserBybitSettings
from app.subscription_billing import ensure_payment_memo
from app.schemas import TelegramUser

router = APIRouter(prefix="/copy-trading", tags=["copy-trading"])


class CopyTradingStatusRead(BaseModel):
    configured: bool
    enabled: bool = False
    api_key_hint: str | None = None
    account_balance_usd: float = 10_000.0
    stake_percent: float = 10.0
    usdt_balance: float | None = None
    balance_error: str | None = None
    usdt_ton_address: str = ""
    fee_percent: float = 20.0
    min_topup_usd: float = MIN_TOPUP_USD
    fee_deposit_usd: float = 0.0
    accrued_fee_usd: float = 0.0
    connected_at: str | None = None
    equity_baseline_usd: float | None = None
    current_equity_usd: float | None = None
    profit_usd: float = 0.0
    unbilled_profit_usd: float = 0.0
    copy_allowed: bool = True
    payment_memo: str = ""


class CopyTradingSaveBody(BaseModel):
    api_key: str = Field(min_length=8, max_length=128)
    api_secret: str = Field(min_length=8, max_length=128)
    enabled: bool = True
    account_balance_usd: float | None = Field(default=None, ge=100, le=10_000_000)
    stake_percent: float = Field(default=10.0, ge=0.1, le=100)


def _sync_deposit_from_balance(row: UserBybitSettings, balance: float | None) -> None:
    if balance is not None and balance > 0:
        row.account_balance_usd = round(balance, 2)
        row.last_equity_usd = round(balance, 2)


class CopyTradingPatchBody(BaseModel):
    enabled: bool | None = None
    account_balance_usd: float | None = Field(default=None, ge=100, le=10_000_000)
    stake_percent: float | None = Field(default=None, ge=0.1, le=100)


class CopyDepositBody(BaseModel):
    tx_id: str = Field(min_length=8, max_length=128)


def _credentials_from_row(row: UserBybitSettings) -> BybitCredentials:
    return BybitCredentials(
        api_key=decrypt_secret(row.api_key_encrypted),
        api_secret=decrypt_secret(row.api_secret_encrypted),
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


def _subscriber_payment_memo(db: Session, telegram_user_id: int) -> str:
    sub = db.get(Subscriber, telegram_user_id)
    if sub is None:
        return ""
    return ensure_payment_memo(db, sub)


def _require_copy_deposit_if_enabling(
    db: Session,
    *,
    telegram_user_id: int,
    enabled: bool,
    is_admin: bool,
) -> None:
    if not enabled or is_admin:
        return
    if not copy_trading_allowed(db, telegram_user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Пополните депозит комиссии (мин. ${MIN_TOPUP_USD:g} USDT TON) — 20% списывается с него автоматически",
        )


def _status_from_snap(
    db: Session,
    row: UserBybitSettings | None,
    *,
    telegram_user_id: int,
    balance: float | None = None,
    balance_error: str | None = None,
) -> CopyTradingStatusRead:
    payment_memo = _subscriber_payment_memo(db, telegram_user_id)
    snap = billing_snapshot(db, telegram_user_id, row, current_equity=balance)

    base = {
        "usdt_ton_address": str(snap["usdt_ton_address"]),
        "fee_percent": float(snap["fee_percent"]),
        "min_topup_usd": float(snap["min_topup_usd"]),
        "fee_deposit_usd": float(snap["fee_deposit_usd"]),
        "accrued_fee_usd": float(snap["accrued_fee_usd"]),
        "connected_at": snap["connected_at"] if isinstance(snap["connected_at"], str) else None,
        "equity_baseline_usd": snap["equity_baseline_usd"] if isinstance(snap["equity_baseline_usd"], (int, float)) else None,
        "current_equity_usd": snap["current_equity_usd"] if isinstance(snap["current_equity_usd"], (int, float)) else None,
        "profit_usd": float(snap["profit_usd"]),
        "unbilled_profit_usd": float(snap["unbilled_profit_usd"]),
        "copy_allowed": bool(snap["copy_allowed"]),
        "payment_memo": payment_memo,
    }

    if row is None:
        return CopyTradingStatusRead(configured=False, **base)

    return CopyTradingStatusRead(
        configured=True,
        enabled=bool(row.enabled),
        api_key_hint=_api_key_hint(row),
        account_balance_usd=float(row.account_balance_usd),
        stake_percent=float(row.stake_percent),
        usdt_balance=balance,
        balance_error=balance_error,
        **base,
    )


async def _refresh_billing(
    db: Session,
    user: TelegramUser,
    row: UserBybitSettings | None,
) -> tuple[float | None, str | None]:
    if row is None:
        return None, None
    balance, balance_error = await _fetch_balance(row)
    _sync_deposit_from_balance(row, balance)
    sub = db.get(Subscriber, user.telegram_user_id)
    if sub is not None:
        ensure_baseline_on_connect(db, sub, row, balance)
        settle_copy_fees_from_deposit(db, user.telegram_user_id, row, balance)
    return balance, balance_error


@router.get("/me", response_model=CopyTradingStatusRead)
async def get_my_copy_trading(
    user: TelegramUser = Depends(get_current_user),
    db: Session = Depends(db_session),
) -> CopyTradingStatusRead:
    row = db.get(UserBybitSettings, user.telegram_user_id)
    balance, balance_error = await _refresh_billing(db, user, row)
    db.commit()
    return _status_from_snap(db, row, telegram_user_id=user.telegram_user_id, balance=balance, balance_error=balance_error)


@router.put("/me", response_model=CopyTradingStatusRead)
async def save_my_copy_trading(
    body: CopyTradingSaveBody,
    user: TelegramUser = Depends(get_current_user),
    db: Session = Depends(db_session),
) -> CopyTradingStatusRead:
    row = db.get(UserBybitSettings, user.telegram_user_id)
    sub = db.get(Subscriber, user.telegram_user_id)
    if sub is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="not_registered")

    _require_copy_deposit_if_enabling(
        db,
        telegram_user_id=user.telegram_user_id,
        enabled=body.enabled,
        is_admin=user.is_admin,
    )

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
    row.testnet = False
    row.stake_percent = round(body.stake_percent, 2)
    db.flush()

    balance, balance_error = await _fetch_balance(row)
    _sync_deposit_from_balance(row, balance)
    if balance is None and body.account_balance_usd is not None:
        row.account_balance_usd = round(body.account_balance_usd, 2)
    ensure_baseline_on_connect(db, sub, row, balance)
    settle_copy_fees_from_deposit(db, user.telegram_user_id, row, balance)
    db.commit()
    db.refresh(row)
    return _status_from_snap(db, row, telegram_user_id=user.telegram_user_id, balance=balance, balance_error=balance_error)


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
        _require_copy_deposit_if_enabling(
            db,
            telegram_user_id=user.telegram_user_id,
            enabled=body.enabled,
            is_admin=user.is_admin,
        )
        row.enabled = body.enabled
    row.testnet = False
    if body.stake_percent is not None:
        row.stake_percent = round(body.stake_percent, 2)
    balance, balance_error = await _fetch_balance(row)
    _sync_deposit_from_balance(row, balance)
    if body.account_balance_usd is not None and (balance is None or balance <= 0):
        row.account_balance_usd = round(body.account_balance_usd, 2)
    sub = db.get(Subscriber, user.telegram_user_id)
    if sub is not None:
        ensure_baseline_on_connect(db, sub, row, balance)
        settle_copy_fees_from_deposit(db, user.telegram_user_id, row, balance)
    db.commit()
    db.refresh(row)
    return _status_from_snap(db, row, telegram_user_id=user.telegram_user_id, balance=balance, balance_error=balance_error)


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
    balance, balance_error = await _refresh_billing(db, user, row)
    db.commit()
    return _status_from_snap(db, row, telegram_user_id=user.telegram_user_id, balance=balance, balance_error=balance_error)


@router.post("/me/deposit", response_model=CopyTradingStatusRead)
async def topup_copy_deposit(
    body: CopyDepositBody,
    user: TelegramUser = Depends(get_current_user),
    db: Session = Depends(db_session),
) -> CopyTradingStatusRead:
    row = db.get(UserBybitSettings, user.telegram_user_id)
    try:
        record_copy_deposit_topup(db, user.telegram_user_id, body.tx_id.strip())
        if row is not None:
            balance, _ = await _fetch_balance(row)
            if balance is not None:
                sub = db.get(Subscriber, user.telegram_user_id)
                if sub is not None:
                    ensure_baseline_on_connect(db, sub, row, balance)
                    settle_copy_fees_from_deposit(db, user.telegram_user_id, row, balance)
        db.commit()
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    if row is not None:
        db.refresh(row)
        balance, balance_error = await _fetch_balance(row)
        return _status_from_snap(db, row, telegram_user_id=user.telegram_user_id, balance=balance, balance_error=balance_error)
    return _status_from_snap(db, None, telegram_user_id=user.telegram_user_id)
