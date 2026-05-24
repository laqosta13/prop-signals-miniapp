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
    leverage: int | None = Field(None, ge=1, le=50)
    risk_percent: float | None = Field(None, ge=0.1, le=100.0)
    tracker_balance: float | None = Field(None, ge=100)


class SignalSupplementRead(BaseModel):
    id: int
    created_at: datetime
    comment: str | None = None
    media_image_url: str | None = None
    media_video_url: str | None = None


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
    leverage: int | None = None
    risk_percent: float | None = None
    tracker_balance: float | None = None
    realized_pnl: float | None = None
    entry_filled_at: datetime | None = None
    views_count: int = 0
    likes_count: int = 0
    liked_by_me: bool = False
    author_telegram_id: int
    author_username: str | None = None
    author_display_name: str | None = None
    media_image_url: str | None = None
    media_video_url: str | None = None
    author_avatar_url: str | None = None
    supplements: list[SignalSupplementRead] = []

    model_config = {"from_attributes": True}


class LikeResponse(BaseModel):
    liked: bool
    likes_count: int


class ViewResponse(BaseModel):
    views_count: int


class TelegramUser(BaseModel):
    telegram_user_id: int
    is_admin: bool
    username: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    notify_enabled: bool = True
    subscription_until: datetime | None = None
    subscription_active: bool = False
    referral_code: str = ""


class SubscriptionUpdate(BaseModel):
    notify_enabled: bool


class PaymentSubmit(BaseModel):
    plan: str = Field(..., pattern="^(week|month)$")
    tx_id: str = Field(..., min_length=8, max_length=128)


class SubscriptionInfo(BaseModel):
    usdt_ton_address: str
    week_usd: float
    month_usd: float
    trial_days: int
    referral_bonus_days: int
    subscription_until: datetime | None
    subscription_active: bool
    referral_code: str
    referral_link_hint: str


class TraderDayStat(BaseModel):
    date: str
    pnl_usd: float
    rating_delta: float
    wins: int
    losses: int


class TraderRead(BaseModel):
    telegram_id: int
    username: str | None
    display_name: str | None = None
    rating_percent: float
    total_pnl_usd: float = 0.0
    wins: int
    losses: int
    rank: int = 0
    win_rate: float = 0.0
    avatar_url: str | None = None
    daily_stats: list[TraderDayStat] = []

    model_config = {"from_attributes": True}


class ChallengeUpdate(BaseModel):
    account_size: float | None = Field(None, ge=1000)
    stage: int | None = Field(None, ge=1, le=3)
    balance: float | None = Field(None, ge=0)
    reset_day: bool = False


class ChallengeDashboard(BaseModel):
    owner_telegram_id: int
    owner_username: str | None = None
    owner_display_name: str | None = None
    owner_avatar_url: str | None = None
    account_size: float
    stage: int
    balance: float
    profit_pct: float
    profit_target_pct: float
    drawdown_pct: float
    max_drawdown_pct: float
    daily_loss_pct: float
    max_daily_loss_pct: float
    daily_remaining_usd: float
    trading_days: int
    min_trading_days: int
    goal_balance: float
    trades_count: int
    winrate: float
    total_pnl: float
    max_leverage: str
