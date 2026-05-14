from fastapi import APIRouter, Depends

from app.deps import get_current_user
from app.schemas import TelegramUser

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=TelegramUser)
def me(user: TelegramUser = Depends(get_current_user)) -> TelegramUser:
    return user
