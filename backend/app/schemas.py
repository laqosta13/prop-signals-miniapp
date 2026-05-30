from datetime import datetime

from pydantic import BaseModel, Field


class SignalSupplementRead(BaseModel):
    id: int
    created_at: datetime
    comment: str | None = None
    media_image_url: str | None = None
    media_video_url: str | None = None


class SignalRead(BaseModel):
    id: int
    number: int
    created_at: datetime
    closed_at: datetime | None = None
    close_reason: str | None = None
    closed_exit_price: float | None = None
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
    account_size: float | None = None
    realized_pnl: float | None = None
    entry_filled_at: datetime | None = None
    published_market_price: float | None = None
    published_market_source: str | None = None
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


class MarketPriceRead(BaseModel):
    symbol: str
    price: float
    source: str = "bybit_perp"


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
    notify_news_enabled: bool = False
    subscription_until: datetime | None = None
    subscription_active: bool = False
    referral_code: str = ""
    member_since: datetime | None = None
    paid_subscription: bool = False
    can_write_review: bool = False
    review_write_blocked_reason: str | None = None
    days_until_review: int | None = None


class SubscriptionUpdate(BaseModel):
    notify_enabled: bool | None = None
    notify_news_enabled: bool | None = None


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
    referral_link: str = ""
    referral_share_text: str = ""
    bot_username: str = ""
    referral_link_hint: str


class TraderDayStat(BaseModel):
    date: str
    pnl_usd: float
    rating_delta: float
    wins: int
    losses: int


class RankHistoryEntryRead(BaseModel):
    week_label: str
    weekly_pct: float
    rank_id: int
    rank_name: str
    confirmed: bool


class TraderRankRead(BaseModel):
    current_rank_id: int
    current_rank_name: str
    weekly_pct: float
    is_confirmed: bool
    confirm_deadline: datetime | None = None
    consecutive_loss_weeks: int = 0
    shield_used_this_month: bool = False
    shield_active: bool = False
    rank_applied_this_week: bool = False
    pending_rank_penalty: bool = False
    rank_history: list[RankHistoryEntryRead] = []


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
    trader_rank: TraderRankRead | None = None
    is_aggregate: bool = False

    model_config = {"from_attributes": True}


class CultChannelRead(BaseModel):
    id: int
    title: str
    username: str
    channel_url: str
    rating_percent: float
    wins: int
    losses: int
    rank: int
    win_rate: float
    connected_at: datetime
    daily_stats: list[TraderDayStat] = []


class CultChannelCreateBody(BaseModel):
    url: str = Field(min_length=4, max_length=256)


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
    profit_target_unlimited: bool = False
    drawdown_pct: float
    max_drawdown_pct: float
    daily_loss_pct: float
    max_daily_loss_pct: float
    daily_remaining_usd: float
    trading_days: int
    min_trading_days: int
    min_trading_days_unlimited: bool = False
    goal_balance: float
    trades_count: int
    winrate: float
    total_pnl: float
    max_leverage: str
    prop_screenshot_url: str | None = None


class ReviewRead(BaseModel):
    id: int
    created_at: datetime
    updated_at: datetime
    author_telegram_id: int
    author_username: str | None = None
    author_display_name: str | None = None
    author_avatar_url: str | None = None
    text: str
    rating: int
    image_url: str | None = None
    is_mine: bool = False


class NewsLinkPreview(BaseModel):
    url: str
    title: str | None = None
    description: str | None = None
    image_url: str | None = None


class NewsRead(BaseModel):
    id: int
    created_at: datetime
    updated_at: datetime
    title: str
    body: str
    image_url: str | None = None
    video_url: str | None = None
    link: NewsLinkPreview | None = None
    author_telegram_id: int
    author_display_name: str | None = None
