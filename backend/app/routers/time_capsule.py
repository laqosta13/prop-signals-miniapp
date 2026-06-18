from datetime import timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.deps import db_session, get_current_user
from app.schemas import TelegramUser
from app.time_capsule_service import create_capsule

router = APIRouter(prefix="/time-capsule", tags=["time-capsule"])


class TimeCapsuleCreate(BaseModel):
    message: str
    delay: str  # "1w" | "1m" | "3m"


class TimeCapsuleResponse(BaseModel):
    id: int
    deliver_at: str


@router.post("", response_model=TimeCapsuleResponse, status_code=status.HTTP_201_CREATED)
def schedule_capsule(
    body: TimeCapsuleCreate,
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(get_current_user),
) -> TimeCapsuleResponse:
    try:
        capsule = create_capsule(db, user.telegram_user_id, body.message, body.delay)
        db.commit()
        db.refresh(capsule)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e

    dt = capsule.deliver_at
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return TimeCapsuleResponse(id=capsule.id, deliver_at=dt.isoformat())
