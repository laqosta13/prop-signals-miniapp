from fastapi import APIRouter, Depends

from app.deps import get_current_user
from app.schemas import SupportInfo, TelegramUser
from app.support_links import build_support_url, telegram_support_username

router = APIRouter(prefix="/support", tags=["support"])


@router.get("/info", response_model=SupportInfo)
def support_info(_user: TelegramUser = Depends(get_current_user)) -> SupportInfo:
    username = telegram_support_username()
    url = build_support_url()
    return SupportInfo(
        username=username,
        url=url,
        available=bool(url),
    )
