"""API настроек копирования сигналов на Bybit."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.bybit_trading import BybitCredentials, get_wallet_usdt_balance
from app.credentials_crypto import decrypt_secret, encrypt_secret
from app.deps import db_session, get_current_user, require_active_subscription
from app.models import UserBybitSettings
from app.schemas import TelegramUser

router = APIRouter(prefix="/copy-trading", tags=["copy-trading"])


class CopyTradingStatusRead(BaseModel):
    configured: bool
    enabled: bool = False
    testnet: bool = True
    api_key_hint: str | None = None
    account_balance_usd: float = 10_000.0
    stake_percent: float = 10.0
    usdt_balance: float | None = None
    balance_error: str | None = None


class CopyTradingSaveBody(BaseModel):
    api_key: str = Field(min_length=8, max_length=128)
    api_secret: str = Field(min_length=8, max_length=128)
    testnet: bool = True
    enabled: bool = True
    account_balance_usd: float = Field(default=10_000.0, ge=100, le=10_000_000)
    stake_percent: float = Field(default=10.0, ge=0.1, le=100)


class CopyTradingPatchBody(BaseModel):
    enabled: bool | None = None
    testnet: bool | None = None
    account_balance_usd: float | None = Field(default=None, ge=100, le=10_000_000)
    stake_percent: float | None = Field(default=None, ge=0.1, le=100)


def _row_to_status(row: UserBybitSettings | None, *, balance: float | None = None, balance_error: str | None = None) -> CopyTradingStatusRead:
    if row is None:
        return CopyTradingStatusRead(configured=False)
    hint = None
    try:
        key = decrypt_secret(row.api_key_encrypted)
        hint = f"{key[:4]}…{key[-4:]}" if len(key) >= 8 else "••••"
    except ValueError:
        hint = "ошибка ключа"
    return CopyTradingStatusRead(
        configured=True,
        enabled=bool(row.enabled),
        testnet=bool(row.testnet),
        api_key_hint=hint,
        account_balance_usd=float(row.account_balance_usd),
        stake_percent=float(row.stake_percent),
        usdt_balance=balance,
        balance_error=balance_error,
    )


def _credentials_from_row(row: UserBybitSettings) -> BybitCredentials:
    return BybitCredentials(
        api_key=decrypt_secret(row.api_key_encrypted),
        api_secret=decrypt_secret(row.api_secret_encrypted),
        testnet=bool(row.testnet),
    )


@router.get("/me", response_model=CopyTradingStatusRead)
async def get_my_copy_trading(
    user: TelegramUser = Depends(get_current_user),
    db: Session = Depends(db_session),
) -> CopyTradingStatusRead:
    row = db.get(UserBybitSettings, user.telegram_user_id)
    if row is None:
        return CopyTradingStatusRead(configured=False)
    balance: float | None = None
    balance_error: str | None = None
    try:
        balance = await get_wallet_usdt_balance(_credentials_from_row(row))
    except Exception as e:
        balance_error = str(e)[:200]
    return _row_to_status(row, balance=balance, balance_error=balance_error)


@router.put("/me", response_model=CopyTradingStatusRead)
async def save_my_copy_trading(
    body: CopyTradingSaveBody,
    user: TelegramUser = Depends(require_active_subscription),
    db: Session = Depends(db_session),
) -> CopyTradingStatusRead:
    row = db.get(UserBybitSettings, user.telegram_user_id)
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
    row.account_balance_usd = round(body.account_balance_usd, 2)
    row.stake_percent = round(body.stake_percent, 2)
    db.commit()
    db.refresh(row)

    balance: float | None = None
    balance_error: str | None = None
    try:
        balance = await get_wallet_usdt_balance(_credentials_from_row(row))
    except Exception as e:
        balance_error = str(e)[:200]
    return _row_to_status(row, balance=balance, balance_error=balance_error)


@router.patch("/me", response_model=CopyTradingStatusRead)
async def patch_my_copy_trading(
    body: CopyTradingPatchBody,
    user: TelegramUser = Depends(require_active_subscription),
    db: Session = Depends(db_session),
) -> CopyTradingStatusRead:
    row = db.get(UserBybitSettings, user.telegram_user_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API не настроен")
    if body.enabled is not None:
        row.enabled = body.enabled
    if body.testnet is not None:
        row.testnet = body.testnet
    if body.account_balance_usd is not None:
        row.account_balance_usd = round(body.account_balance_usd, 2)
    if body.stake_percent is not None:
        row.stake_percent = round(body.stake_percent, 2)
    db.commit()
    db.refresh(row)
    return _row_to_status(row)


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
    user: TelegramUser = Depends(require_active_subscription),
    db: Session = Depends(db_session),
) -> CopyTradingStatusRead:
    row = db.get(UserBybitSettings, user.telegram_user_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Сначала сохраните API-ключи")
    try:
        balance = await get_wallet_usdt_balance(_credentials_from_row(row))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Не удалось подключиться к Bybit: {e}",
        ) from e
    return _row_to_status(row, balance=balance)
