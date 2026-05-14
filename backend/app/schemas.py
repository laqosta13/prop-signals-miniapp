from datetime import datetime

from pydantic import BaseModel, Field


class SignalCreate(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=32)
    direction: str = Field(..., pattern="^(long|short)$")
    entry_low: str | None = None
    entry_high: str | None = None
    stop_loss: str | None = None
    take_profits: str | None = Field(None, description="JSON array string, e.g. [\"1.09\",\"1.10\"]")
    comment: str | None = None


class SignalRead(BaseModel):
    id: int
    created_at: datetime
    symbol: str
    direction: str
    entry_low: str | None
    entry_high: str | None
    stop_loss: str | None
    take_profits: str | None
    comment: str | None
    status: str
    author_telegram_id: int

    model_config = {"from_attributes": True}


class TelegramUser(BaseModel):
    telegram_user_id: int
    is_admin: bool
