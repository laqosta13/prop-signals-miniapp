from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import db_session, get_current_user, require_admin
from app.models import Signal
from app.schemas import SignalCreate, SignalRead, TelegramUser

router = APIRouter(prefix="/signals", tags=["signals"])


@router.get("", response_model=list[SignalRead])
def list_signals(
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(get_current_user),
) -> list[Signal]:
    _ = user
    stmt = select(Signal).order_by(Signal.created_at.desc()).limit(200)
    return list(db.scalars(stmt).all())


@router.post("", response_model=SignalRead)
def create_signal(
    body: SignalCreate,
    db: Session = Depends(db_session),
    admin: TelegramUser = Depends(require_admin),
) -> Signal:
    row = Signal(
        symbol=body.symbol.strip().upper(),
        direction=body.direction.lower(),
        entry_low=body.entry_low,
        entry_high=body.entry_high,
        stop_loss=body.stop_loss,
        take_profits=body.take_profits,
        comment=body.comment,
        status="active",
        author_telegram_id=admin.telegram_user_id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
