from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Signal(Base):
    __tablename__ = "signals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    number: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    close_reason: Mapped[str | None] = mapped_column(String(16), nullable=True)  # stop | target | market
    closed_exit_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    symbol: Mapped[str] = mapped_column(String(32), nullable=False)
    direction: Mapped[str] = mapped_column(String(8), nullable=False)  # long | short
    entry_low: Mapped[str | None] = mapped_column(String(32), nullable=True)
    entry_high: Mapped[str | None] = mapped_column(String(32), nullable=True)
    stop_loss: Mapped[str | None] = mapped_column(String(32), nullable=True)
    take_profits: Mapped[str | None] = mapped_column(Text, nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="active")  # active | win | lose
    entry_filled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    published_market_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    published_market_source: Mapped[str | None] = mapped_column(String(32), nullable=True)
    points_percent: Mapped[float] = mapped_column(Float, default=1.0)
    leverage: Mapped[int | None] = mapped_column(Integer, nullable=True)
    risk_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    realized_pnl: Mapped[float | None] = mapped_column(Float, nullable=True)
    media_image_path: Mapped[str | None] = mapped_column(String(256), nullable=True)
    media_video_path: Mapped[str | None] = mapped_column(String(256), nullable=True)
    tracker_balance: Mapped[float | None] = mapped_column(Float, nullable=True)
    account_size: Mapped[float | None] = mapped_column(Float, nullable=True)
    views_count: Mapped[int] = mapped_column(Integer, default=0)
    likes_count: Mapped[int] = mapped_column(Integer, default=0)
    author_telegram_id: Mapped[int] = mapped_column(Integer, nullable=False)
    author_username: Mapped[str | None] = mapped_column(String(64), nullable=True)


class SignalSupplement(Base):
    """Дополнение к сигналу (комментарий / медиа после публикации)."""

    __tablename__ = "signal_supplements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    signal_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    media_image_path: Mapped[str | None] = mapped_column(String(256), nullable=True)
    media_video_path: Mapped[str | None] = mapped_column(String(256), nullable=True)


class SignalView(Base):
    __tablename__ = "signal_views"

    signal_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    telegram_user_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SignalLike(Base):
    __tablename__ = "signal_likes"

    signal_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    telegram_user_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UserChallenge(Base):
    """Трекер Hash Hedge — только для админов (telegram_user_id = admin)."""

    __tablename__ = "user_challenges"

    telegram_user_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_size: Mapped[float] = mapped_column(Float, default=10_000.0)
    stage: Mapped[int] = mapped_column(Integer, default=1)
    balance: Mapped[float] = mapped_column(Float, default=10_000.0)
    day_start_balance: Mapped[float] = mapped_column(Float, default=10_000.0)
    trading_days: Mapped[int] = mapped_column(Integer, default=0)
    prop_screenshot_path: Mapped[str | None] = mapped_column(String(256), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Trader(Base):
    __tablename__ = "traders"

    telegram_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str | None] = mapped_column(String(64), nullable=True)
    first_name: Mapped[str | None] = mapped_column(String(64), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(64), nullable=True)
    avatar_path: Mapped[str | None] = mapped_column(String(256), nullable=True)
    rating_percent: Mapped[float] = mapped_column(Float, default=0.0)
    total_pnl_usd: Mapped[float] = mapped_column(Float, default=0.0)
    wins: Mapped[int] = mapped_column(Integer, default=0)
    losses: Mapped[int] = mapped_column(Integer, default=0)
    current_rank_id: Mapped[int] = mapped_column(Integer, default=8)
    weekly_pct: Mapped[float] = mapped_column(Float, default=0.0)
    is_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    confirm_deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    consecutive_loss_weeks: Mapped[int] = mapped_column(Integer, default=0)
    shield_used_this_month: Mapped[bool] = mapped_column(Boolean, default=False)
    shield_active: Mapped[bool] = mapped_column(Boolean, default=False)
    rank_applied_this_week: Mapped[bool] = mapped_column(Boolean, default=False)
    rank_history_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Subscriber(Base):
    __tablename__ = "subscribers"

    telegram_user_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str | None] = mapped_column(String(64), nullable=True)
    notify_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_news_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    subscription_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    referral_code: Mapped[str | None] = mapped_column(String(16), nullable=True, unique=True)
    referred_by_telegram_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PaymentTx(Base):
    __tablename__ = "payment_txs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    telegram_user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    tx_id: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    plan: Mapped[str] = mapped_column(String(16), nullable=False)
    amount_usd: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    author_telegram_id: Mapped[int] = mapped_column(Integer, nullable=False, unique=True, index=True)
    author_username: Mapped[str | None] = mapped_column(String(64), nullable=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    rating: Mapped[int] = mapped_column(Integer, default=5)
    image_path: Mapped[str | None] = mapped_column(String(256), nullable=True)


class NewsPost(Base):
    __tablename__ = "news_posts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    image_path: Mapped[str | None] = mapped_column(String(256), nullable=True)
    video_path: Mapped[str | None] = mapped_column(String(256), nullable=True)
    link_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    link_title: Mapped[str | None] = mapped_column(String(300), nullable=True)
    link_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    link_image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    author_telegram_id: Mapped[int] = mapped_column(Integer, nullable=False)
