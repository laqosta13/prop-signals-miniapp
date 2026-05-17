from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Signal(Base):
    __tablename__ = "signals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    symbol: Mapped[str] = mapped_column(String(32), nullable=False)
    direction: Mapped[str] = mapped_column(String(8), nullable=False)  # long | short
    entry_low: Mapped[str | None] = mapped_column(String(32), nullable=True)
    entry_high: Mapped[str | None] = mapped_column(String(32), nullable=True)
    stop_loss: Mapped[str | None] = mapped_column(String(32), nullable=True)
    take_profits: Mapped[str | None] = mapped_column(Text, nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="active")  # active | win | lose
    points_percent: Mapped[float] = mapped_column(Float, default=1.0)
    leverage: Mapped[int | None] = mapped_column(Integer, nullable=True)
    risk_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    realized_pnl: Mapped[float | None] = mapped_column(Float, nullable=True)
    media_image_path: Mapped[str | None] = mapped_column(String(256), nullable=True)
    media_video_path: Mapped[str | None] = mapped_column(String(256), nullable=True)
    tracker_balance: Mapped[float | None] = mapped_column(Float, nullable=True)
    views_count: Mapped[int] = mapped_column(Integer, default=0)
    likes_count: Mapped[int] = mapped_column(Integer, default=0)
    author_telegram_id: Mapped[int] = mapped_column(Integer, nullable=False)
    author_username: Mapped[str | None] = mapped_column(String(64), nullable=True)


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
    """Персональный трекер челленджа Hash Hedge."""

    __tablename__ = "user_challenges"

    telegram_user_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_size: Mapped[float] = mapped_column(Float, default=10_000.0)
    stage: Mapped[int] = mapped_column(Integer, default=1)
    balance: Mapped[float] = mapped_column(Float, default=10_000.0)
    day_start_balance: Mapped[float] = mapped_column(Float, default=10_000.0)
    trading_days: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Trader(Base):
    __tablename__ = "traders"

    telegram_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str | None] = mapped_column(String(64), nullable=True)
    avatar_path: Mapped[str | None] = mapped_column(String(256), nullable=True)
    rating_percent: Mapped[float] = mapped_column(Float, default=0.0)
    total_pnl_usd: Mapped[float] = mapped_column(Float, default=0.0)
    wins: Mapped[int] = mapped_column(Integer, default=0)
    losses: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Subscriber(Base):
    __tablename__ = "subscribers"

    telegram_user_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str | None] = mapped_column(String(64), nullable=True)
    notify_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
