from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import db_session, get_current_user, require_admin
from app.models import Signal
from app.schemas import SignalCreate, SignalRead, TelegramUser
from app.signal_service import build_signal_row, notify_new_signal

router = APIRouter(prefix="/signals", tags=["signals"])


@router.get("", response_model=list[SignalRead])
def list_signals(
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(get_current_user),
) -> list[Signal]:
    stmt = select(Signal).order_by(Signal.created_at.desc()).limit(200)
    return list(db.scalars(stmt).all())


@router.post("", response_model=SignalRead)
async def create_signal(
    body: SignalCreate,
    db: Session = Depends(db_session),
    admin: TelegramUser = Depends(require_admin),
) -> Signal:
    row = build_signal_row(
        db,
        symbol=body.symbol.strip().upper(),
        direction=body.direction.lower(),
        entry_low=body.entry_low,
        entry_high=body.entry_high,
        stop_loss=body.stop_loss,
        take_profits=body.take_profits,
        comment=body.comment,
        author_telegram_id=admin.telegram_user_id,
        author_username=admin.username,
        leverage=body.leverage,
        risk_percent=body.risk_percent,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    await notify_new_signal(db, row)
    return row


@router.delete("/{signal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_signal(
    signal_id: int,
    db: Session = Depends(db_session),
    admin: TelegramUser = Depends(require_admin),
) -> None:
    _ = admin
    row = db.get(Signal, signal_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signal not found")
    if row.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Можно удалить только активный сигнал",
        )
    db.delete(row)
    db.commit()
