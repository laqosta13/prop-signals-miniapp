from datetime import datetime

from pydantic import BaseModel, Field


class SignalCreate(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=32)
    direction: str = Field(..., pattern="^(long|short)$")
    entry_low: str | None = None
    entry_high: str | None = None
    stop_loss: str | None = None
    take_profits: str | None = None
    comment: str | None = None


class SignalRead(BaseModel):
    id: int
    created_at: datetime
    closed_at: datetime | None = None
    symbol: str
    direction: str
    entry_low: str | None
    entry_high: str | None
    stop_loss: str | None
    take_profits: str | None
    comment: str | None
    status: str
    points_percent: float = 1.0
    author_telegram_id: int
    author_username: str | None = None

    model_config = {"from_attributes": True}


class TelegramUser(BaseModel):
    telegram_user_id: int
    is_admin: bool
    username: str | None = None
    notify_enabled: bool = True


class SubscriptionUpdate(BaseModel):
    notify_enabled: bool


class TraderRead(BaseModel):
    telegram_id: int
    username: str | None
    rating_percent: float
    wins: int
    losses: int
    rank: int = 0
    win_rate: float = 0.0

    model_config = {"from_attributes": True}
