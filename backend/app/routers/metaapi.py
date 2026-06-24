"""API настроек MetaAPI (MT4/MT5 копирование сигналов)."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import settings
from app.credentials_crypto import decrypt_secret, encrypt_secret
from app.deps import db_session, get_current_user
from app.metaapi_trading import get_account_info
from app.models import UserMetaApiSettings
from app.schemas import TelegramUser

router = APIRouter(prefix="/meta-api", tags=["meta-api"])


class MetaApiStatusRead(BaseModel):
    configured: bool
    enabled: bool = False
    account_id_hint: str | None = None
    lot_size: float = 0.01
    balance: float | None = None
    currency: str | None = None
    balance_error: str | None = None
    connected_at: str | None = None


class MetaApiSaveBody(BaseModel):
    account_id: str = Field(min_length=1, max_length=128)
    lot_size: float = Field(default=0.01, ge=0.001, le=100.0)
    enabled: bool = True


def _require_token() -> str:
    token = settings.metaapi_token.strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MetaAPI не настроен на сервере (METAAPI_TOKEN отсутствует)",
        )
    return token


def _account_id_hint(row: UserMetaApiSettings) -> str | None:
    try:
        aid = decrypt_secret(row.account_id_encrypted)
        return f"{aid[:8]}…" if len(aid) >= 8 else "••••"
    except ValueError:
        return "ошибка"


def _row_to_status(row: UserMetaApiSettings | None, *, balance: float | None = None, currency: str | None = None, balance_error: str | None = None) -> MetaApiStatusRead:
    if row is None:
        return MetaApiStatusRead(configured=False)
    return MetaApiStatusRead(
        configured=True,
        enabled=row.enabled,
        account_id_hint=_account_id_hint(row),
        lot_size=row.lot_size,
        balance=balance if balance is not None else row.last_balance,
        currency=currency or row.last_currency,
        balance_error=balance_error,
        connected_at=row.connected_at.isoformat() if row.connected_at else None,
    )


@router.get("/status", response_model=MetaApiStatusRead)
async def get_status(
    user: TelegramUser = Depends(get_current_user),
    db: Session = Depends(db_session),
) -> MetaApiStatusRead:
    row = db.get(UserMetaApiSettings, user.telegram_user_id)
    if row is None:
        return MetaApiStatusRead(configured=False)

    token = settings.metaapi_token.strip()
    if not token:
        return _row_to_status(row, balance_error="MetaAPI не настроен на сервере")

    balance: float | None = None
    currency: str | None = None
    balance_error: str | None = None
    try:
        account_id = decrypt_secret(row.account_id_encrypted)
        info = await get_account_info(token, account_id)
        balance = float(info.get("balance") or info.get("equity") or 0) or None
        currency = str(info.get("currency") or "USD")
        if balance is not None:
            row.last_balance = balance
            row.last_currency = currency
            db.commit()
    except Exception as e:
        balance_error = str(e)[:200]

    return _row_to_status(row, balance=balance, currency=currency, balance_error=balance_error)


@router.post("/save", response_model=MetaApiStatusRead)
async def save_settings(
    body: MetaApiSaveBody,
    user: TelegramUser = Depends(get_current_user),
    db: Session = Depends(db_session),
) -> MetaApiStatusRead:
    token = _require_token()

    new_account_id = body.account_id.strip()
    row = db.get(UserMetaApiSettings, user.telegram_user_id)

    # Если account_id не менялся (пустой или "keep") — обновляем только настройки
    changing_account = new_account_id and new_account_id != "keep"
    if not changing_account and row is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Введите MetaAPI Account ID",
        )

    balance: float | None = None
    currency: str | None = None

    if changing_account:
        try:
            info = await get_account_info(token, new_account_id)
        except RuntimeError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
        balance = float(info.get("balance") or info.get("equity") or 0) or None
        currency = str(info.get("currency") or "USD")

    if row is None:
        row = UserMetaApiSettings(
            telegram_user_id=user.telegram_user_id,
            connected_at=datetime.now(timezone.utc),
        )
        db.add(row)

    if changing_account:
        row.account_id_encrypted = encrypt_secret(new_account_id)
        row.last_balance = balance
        row.last_currency = currency

    row.lot_size = body.lot_size
    row.enabled = body.enabled
    db.commit()

    return _row_to_status(row, balance=balance, currency=currency)


@router.delete("/disconnect", status_code=status.HTTP_200_OK)
def disconnect(
    user: TelegramUser = Depends(get_current_user),
    db: Session = Depends(db_session),
) -> dict:
    row = db.get(UserMetaApiSettings, user.telegram_user_id)
    if row is not None:
        db.delete(row)
        db.commit()
    return {}
