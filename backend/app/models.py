from datetime import date, datetime

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
    entry_notified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
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
    is_cult_candidate: Mapped[bool] = mapped_column(Boolean, default=False)


class UserBybitSettings(Base):
    """API Bybit пользователя для копирования сигналов volnovoi."""

    __tablename__ = "user_bybit_settings"

    telegram_user_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    api_key_encrypted: Mapped[str] = mapped_column(String(512), nullable=False)
    api_secret_encrypted: Mapped[str] = mapped_column(String(512), nullable=False)
    testnet: Mapped[bool] = mapped_column(Boolean, default=False)
    account_balance_usd: Mapped[float] = mapped_column(Float, default=10_000.0)
    stake_percent: Mapped[float] = mapped_column(Float, default=100.0)
    connected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    equity_baseline_usd: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_equity_usd: Mapped[float | None] = mapped_column(Float, nullable=True)
    billed_profit_usd: Mapped[float] = mapped_column(Float, default=0.0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class UserMetaApiSettings(Base):
    """MT4/MT5 аккаунт пользователя через MetaAPI для копирования сигналов."""

    __tablename__ = "user_metaapi_settings"

    telegram_user_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    account_id_encrypted: Mapped[str] = mapped_column(String(512), nullable=False)
    lot_size: Mapped[float] = mapped_column(Float, default=0.01)
    connected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_balance: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_currency: Mapped[str | None] = mapped_column(String(16), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class SignalMetaApiTrade(Base):
    """Копия сигнала на MT-аккаунте пользователя через MetaAPI."""

    __tablename__ = "signal_metaapi_trades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    signal_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    telegram_user_id: Mapped[int] = mapped_column(Integer, nullable=False)
    exchange_status: Mapped[str | None] = mapped_column(String(16), nullable=True)
    exchange_symbol: Mapped[str | None] = mapped_column(String(32), nullable=True)
    position_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    lot_size: Mapped[float | None] = mapped_column(Float, nullable=True)
    exchange_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CopyTradingInvoice(Base):
    """Счёт 20% от прибыли копирования volnovoi."""

    __tablename__ = "copy_trading_invoices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    telegram_user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    period_date: Mapped[date] = mapped_column(nullable=False)
    profit_usd: Mapped[float] = mapped_column(Float, nullable=False)
    fee_usd: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="pending")
    tx_id: Mapped[str | None] = mapped_column(String(128), nullable=True, unique=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SignalCopyTrade(Base):
    """Копия сигнала на бирже пользователя."""

    __tablename__ = "signal_copy_trades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    signal_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    telegram_user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    exchange_status: Mapped[str | None] = mapped_column(String(16), nullable=True)
    exchange_pair: Mapped[str | None] = mapped_column(String(32), nullable=True)
    exchange_qty: Mapped[float | None] = mapped_column(Float, nullable=True)
    exchange_order_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    exchange_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


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
    account_size: Mapped[float] = mapped_column(Float, default=1_000.0)
    stage: Mapped[int] = mapped_column(Integer, default=1)
    balance: Mapped[float] = mapped_column(Float, default=1_000.0)
    day_start_balance: Mapped[float] = mapped_column(Float, default=1_000.0)
    trading_days: Mapped[int] = mapped_column(Integer, default=0)
    prop_trading_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    prop_screenshot_path: Mapped[str | None] = mapped_column(String(256), nullable=True)
    prop_screenshot_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
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
    current_rank_id: Mapped[int] = mapped_column(Integer, default=7)
    weekly_pct: Mapped[float] = mapped_column(Float, default=0.0)
    consecutive_loss_weeks: Mapped[int] = mapped_column(Integer, default=0)
    rank_history_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class TraderRosterOverride(Base):
    """Ручная ротация трейдеров главным админом: top / candidate / fired."""

    __tablename__ = "trader_roster_overrides"

    telegram_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    section: Mapped[str] = mapped_column(String(16), nullable=False)  # top | candidate | fired
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CultCandidate(Base):
    """Пользователь-кандидат в CULT: свои сигналы и сделки на Bybit."""

    __tablename__ = "cult_candidates"

    telegram_user_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    display_name: Mapped[str] = mapped_column(String(64), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    rating_percent: Mapped[float] = mapped_column(Float, default=0.0)
    wins: Mapped[int] = mapped_column(Integer, default=0)
    losses: Mapped[int] = mapped_column(Integer, default=0)
    outside_trade: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CultChannel(Base):
    """Telegram-канал в блоке «КОНДИДАТЫ В CULT» — аналитика с момента подключения."""

    __tablename__ = "cult_channels"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(128), nullable=False)
    username: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    chat_id: Mapped[int | None] = mapped_column(Integer, nullable=True, unique=True, index=True)
    channel_url: Mapped[str] = mapped_column(String(256), nullable=False)
    connected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    rating_percent: Mapped[float] = mapped_column(Float, default=0.0)
    wins: Mapped[int] = mapped_column(Integer, default=0)
    losses: Mapped[int] = mapped_column(Integer, default=0)
    added_by_telegram_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CultChannelSignal(Base):
    """Сигнал из поста канала (тикер, вход, стоп, цель)."""

    __tablename__ = "cult_channel_signals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cult_channel_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    telegram_message_id: Mapped[int] = mapped_column(Integer, nullable=False)
    message_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    symbol: Mapped[str] = mapped_column(String(32), nullable=False)
    direction: Mapped[str] = mapped_column(String(8), nullable=False)
    entry_low: Mapped[str | None] = mapped_column(String(32), nullable=True)
    entry_high: Mapped[str | None] = mapped_column(String(32), nullable=True)
    stop_loss: Mapped[str | None] = mapped_column(String(32), nullable=True)
    take_profits: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="active")
    entry_filled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    close_reason: Mapped[str | None] = mapped_column(String(16), nullable=True)
    closed_exit_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    published_market_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Subscriber(Base):
    __tablename__ = "subscribers"

    telegram_user_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str | None] = mapped_column(String(64), nullable=True)
    notify_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_news_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    subscription_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    trial_used: Mapped[bool] = mapped_column(Boolean, default=False)
    cult_subscription_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    referral_code: Mapped[str | None] = mapped_column(String(16), nullable=True, unique=True)
    payment_memo: Mapped[str | None] = mapped_column(String(16), nullable=True, unique=True)
    copy_equity_baseline_usd: Mapped[float | None] = mapped_column(Float, nullable=True)
    copy_billed_profit_usd: Mapped[float] = mapped_column(Float, default=0.0)
    copy_fee_deposit_usd: Mapped[float] = mapped_column(Float, default=0.0)
    copy_connected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    referred_by_telegram_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SubscriptionPauseDay(Base):
    """Обработанные MSK-сутки: при 0 сигналов подписчикам начислен +1 день."""

    __tablename__ = "subscription_pause_days"

    msk_date: Mapped[str] = mapped_column(String(10), primary_key=True)
    signals_count: Mapped[int] = mapped_column(Integer, default=0)
    subscribers_extended: Mapped[int] = mapped_column(Integer, default=0)
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


class SupportThread(Base):
    __tablename__ = "support_threads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    telegram_user_id: Mapped[int] = mapped_column(Integer, nullable=False, unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class SupportMessage(Base):
    __tablename__ = "support_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    thread_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    direction: Mapped[str] = mapped_column(String(8), nullable=False)  # user | staff
    text: Mapped[str] = mapped_column(Text, nullable=False)
    group_message_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


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
    pinned: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")


class TimeCapsule(Base):
    __tablename__ = "time_capsules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    telegram_user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    deliver_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
