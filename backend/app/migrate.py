"""Лёгкие миграции SQLite без Alembic."""

from pathlib import Path

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def _has_column(engine: Engine, table: str, column: str) -> bool:
    insp = inspect(engine)
    if table not in insp.get_table_names():
        return False
    return column in {c["name"] for c in insp.get_columns(table)}


def _marker_path(engine: Engine, name: str) -> Path | None:
    if not str(engine.url).startswith("sqlite"):
        return None
    db_file = engine.url.database
    if not db_file or db_file == ":memory:":
        return None
    return Path(db_file).resolve().parent / name


def _backfill_signal_numbers(conn) -> None:
    if not _has_column(conn.engine, "signals", "number"):
        return
    null_count = conn.execute(text("SELECT COUNT(*) FROM signals WHERE number IS NULL")).scalar() or 0
    if null_count == 0:
        return
    rows = conn.execute(text("SELECT id FROM signals ORDER BY created_at ASC, id ASC")).fetchall()
    for idx, (signal_id,) in enumerate(rows, start=1):
        conn.execute(text("UPDATE signals SET number = :n WHERE id = :id"), {"n": idx, "id": signal_id})


def run_migrations(engine: Engine) -> None:
    tables = inspect(engine).get_table_names()
    with engine.begin() as conn:
        if "signals" in tables:
            for col, ddl in (
                ("closed_at", "ALTER TABLE signals ADD COLUMN closed_at DATETIME"),
                ("points_percent", "ALTER TABLE signals ADD COLUMN points_percent REAL DEFAULT 1.0"),
                ("author_username", "ALTER TABLE signals ADD COLUMN author_username VARCHAR(64)"),
                ("leverage", "ALTER TABLE signals ADD COLUMN leverage INTEGER"),
                ("risk_percent", "ALTER TABLE signals ADD COLUMN risk_percent REAL"),
                ("realized_pnl", "ALTER TABLE signals ADD COLUMN realized_pnl REAL"),
                ("media_image_path", "ALTER TABLE signals ADD COLUMN media_image_path VARCHAR(256)"),
                ("media_video_path", "ALTER TABLE signals ADD COLUMN media_video_path VARCHAR(256)"),
                ("tracker_balance", "ALTER TABLE signals ADD COLUMN tracker_balance REAL"),
                ("account_size", "ALTER TABLE signals ADD COLUMN account_size REAL"),
                ("views_count", "ALTER TABLE signals ADD COLUMN views_count INTEGER DEFAULT 0"),
                ("likes_count", "ALTER TABLE signals ADD COLUMN likes_count INTEGER DEFAULT 0"),
                ("entry_filled_at", "ALTER TABLE signals ADD COLUMN entry_filled_at DATETIME"),
                ("entry_notified_at", "ALTER TABLE signals ADD COLUMN entry_notified_at DATETIME"),
                ("published_market_price", "ALTER TABLE signals ADD COLUMN published_market_price REAL"),
                ("published_market_source", "ALTER TABLE signals ADD COLUMN published_market_source VARCHAR(32)"),
                ("number", "ALTER TABLE signals ADD COLUMN number INTEGER"),
                ("close_reason", "ALTER TABLE signals ADD COLUMN close_reason VARCHAR(16)"),
                ("closed_exit_price", "ALTER TABLE signals ADD COLUMN closed_exit_price REAL"),
                ("exchange_status", "ALTER TABLE signals ADD COLUMN exchange_status VARCHAR(16)"),
                ("exchange_pair", "ALTER TABLE signals ADD COLUMN exchange_pair VARCHAR(32)"),
                ("exchange_qty", "ALTER TABLE signals ADD COLUMN exchange_qty REAL"),
                ("exchange_order_id", "ALTER TABLE signals ADD COLUMN exchange_order_id VARCHAR(64)"),
                ("exchange_error", "ALTER TABLE signals ADD COLUMN exchange_error TEXT"),
                ("is_cult_candidate", "ALTER TABLE signals ADD COLUMN is_cult_candidate BOOLEAN DEFAULT 0"),
            ):
                if not _has_column(engine, "signals", col):
                    conn.execute(text(ddl))
            conn.execute(text("UPDATE signals SET points_percent = 1.0 WHERE points_percent IS NULL"))
            conn.execute(text("UPDATE signals SET views_count = 0 WHERE views_count IS NULL"))
            conn.execute(text("UPDATE signals SET likes_count = 0 WHERE likes_count IS NULL"))
            _backfill_signal_numbers(conn)
            conn.execute(
                text(
                    "UPDATE signals SET close_reason = 'target' "
                    "WHERE status = 'win' AND close_reason IS NULL"
                )
            )
            conn.execute(
                text(
                    "UPDATE signals SET close_reason = 'stop' "
                    "WHERE status = 'lose' AND close_reason IS NULL"
                )
            )

        if "subscribers" in tables:
            if not _has_column(engine, "subscribers", "subscription_until"):
                conn.execute(text("ALTER TABLE subscribers ADD COLUMN subscription_until DATETIME"))
            if not _has_column(engine, "subscribers", "referral_code"):
                conn.execute(text("ALTER TABLE subscribers ADD COLUMN referral_code VARCHAR(16)"))
            if not _has_column(engine, "subscribers", "referred_by_telegram_id"):
                conn.execute(text("ALTER TABLE subscribers ADD COLUMN referred_by_telegram_id INTEGER"))
            if not _has_column(engine, "subscribers", "notify_news_enabled"):
                conn.execute(text("ALTER TABLE subscribers ADD COLUMN notify_news_enabled BOOLEAN DEFAULT 0"))
                conn.execute(text("UPDATE subscribers SET notify_news_enabled = 0 WHERE notify_news_enabled IS NULL"))
            if not _has_column(engine, "subscribers", "cult_subscription_until"):
                conn.execute(text("ALTER TABLE subscribers ADD COLUMN cult_subscription_until DATETIME"))
            if not _has_column(engine, "subscribers", "trial_used"):
                conn.execute(text("ALTER TABLE subscribers ADD COLUMN trial_used BOOLEAN DEFAULT 0"))
                conn.execute(text("UPDATE subscribers SET trial_used = 1"))
            if not _has_column(engine, "subscribers", "payment_memo"):
                conn.execute(text("ALTER TABLE subscribers ADD COLUMN payment_memo VARCHAR(16)"))
            if not _has_column(engine, "subscribers", "copy_equity_baseline_usd"):
                conn.execute(text("ALTER TABLE subscribers ADD COLUMN copy_equity_baseline_usd REAL"))
            if not _has_column(engine, "subscribers", "copy_billed_profit_usd"):
                conn.execute(text("ALTER TABLE subscribers ADD COLUMN copy_billed_profit_usd REAL DEFAULT 0"))
                conn.execute(text("UPDATE subscribers SET copy_billed_profit_usd = 0 WHERE copy_billed_profit_usd IS NULL"))
            if not _has_column(engine, "subscribers", "copy_connected_at"):
                conn.execute(text("ALTER TABLE subscribers ADD COLUMN copy_connected_at DATETIME"))
            if not _has_column(engine, "subscribers", "copy_fee_deposit_usd"):
                conn.execute(text("ALTER TABLE subscribers ADD COLUMN copy_fee_deposit_usd REAL DEFAULT 0"))
                conn.execute(text("UPDATE subscribers SET copy_fee_deposit_usd = 0 WHERE copy_fee_deposit_usd IS NULL"))
            conn.execute(
                text(
                    "UPDATE subscribers SET subscription_until = datetime('now', '+3 days') "
                    "WHERE subscription_until IS NULL"
                )
            )

        if "signal_supplements" not in inspect(engine).get_table_names():
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS signal_supplements (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        signal_id INTEGER NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        comment TEXT,
                        media_image_path VARCHAR(256),
                        media_video_path VARCHAR(256)
                    )
                    """
                )
            )
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_signal_supplements_signal_id ON signal_supplements (signal_id)"))

        if "payment_txs" not in inspect(engine).get_table_names():
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS payment_txs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        telegram_user_id INTEGER NOT NULL,
                        tx_id VARCHAR(128) NOT NULL UNIQUE,
                        plan VARCHAR(16) NOT NULL,
                        amount_usd REAL NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                    """
                )
            )

        if "traders" in tables:
            if not _has_column(engine, "traders", "avatar_path"):
                conn.execute(text("ALTER TABLE traders ADD COLUMN avatar_path VARCHAR(256)"))
            if not _has_column(engine, "traders", "total_pnl_usd"):
                conn.execute(text("ALTER TABLE traders ADD COLUMN total_pnl_usd REAL DEFAULT 0"))
            if not _has_column(engine, "traders", "first_name"):
                conn.execute(text("ALTER TABLE traders ADD COLUMN first_name VARCHAR(64)"))
            if not _has_column(engine, "traders", "last_name"):
                conn.execute(text("ALTER TABLE traders ADD COLUMN last_name VARCHAR(64)"))
            conn.execute(text("UPDATE traders SET wins = 0 WHERE wins IS NULL"))
            conn.execute(text("UPDATE traders SET losses = 0 WHERE losses IS NULL"))
            conn.execute(text("UPDATE traders SET rating_percent = 0.0 WHERE rating_percent IS NULL"))
            conn.execute(text("UPDATE traders SET total_pnl_usd = 0 WHERE total_pnl_usd IS NULL"))
            for col, ddl in (
                ("current_rank_id", "ALTER TABLE traders ADD COLUMN current_rank_id INTEGER DEFAULT 8"),
                ("weekly_pct", "ALTER TABLE traders ADD COLUMN weekly_pct REAL DEFAULT 0"),
                ("is_confirmed", "ALTER TABLE traders ADD COLUMN is_confirmed BOOLEAN DEFAULT 0"),
                ("confirm_deadline", "ALTER TABLE traders ADD COLUMN confirm_deadline DATETIME"),
                ("consecutive_loss_weeks", "ALTER TABLE traders ADD COLUMN consecutive_loss_weeks INTEGER DEFAULT 0"),
                ("shield_used_this_month", "ALTER TABLE traders ADD COLUMN shield_used_this_month BOOLEAN DEFAULT 0"),
                ("shield_active", "ALTER TABLE traders ADD COLUMN shield_active BOOLEAN DEFAULT 0"),
                ("rank_applied_this_week", "ALTER TABLE traders ADD COLUMN rank_applied_this_week BOOLEAN DEFAULT 0"),
                ("rank_history_json", "ALTER TABLE traders ADD COLUMN rank_history_json TEXT"),
            ):
                if not _has_column(engine, "traders", col):
                    conn.execute(text(ddl))
            conn.execute(text("UPDATE traders SET current_rank_id = 8 WHERE current_rank_id IS NULL"))
            conn.execute(text("UPDATE traders SET weekly_pct = 0 WHERE weekly_pct IS NULL"))
            conn.execute(text("UPDATE traders SET is_confirmed = 0 WHERE is_confirmed IS NULL"))
            conn.execute(text("UPDATE traders SET consecutive_loss_weeks = 0 WHERE consecutive_loss_weeks IS NULL"))
            conn.execute(text("UPDATE traders SET shield_used_this_month = 0 WHERE shield_used_this_month IS NULL"))
            conn.execute(text("UPDATE traders SET shield_active = 0 WHERE shield_active IS NULL"))
            conn.execute(text("UPDATE traders SET rank_applied_this_week = 0 WHERE rank_applied_this_week IS NULL"))

        if "user_challenges" in tables:
            if not _has_column(engine, "user_challenges", "prop_screenshot_path"):
                conn.execute(text("ALTER TABLE user_challenges ADD COLUMN prop_screenshot_path VARCHAR(256)"))

        if "reviews" in tables:
            if not _has_column(engine, "reviews", "image_path"):
                conn.execute(text("ALTER TABLE reviews ADD COLUMN image_path VARCHAR(256)"))

        table_names = inspect(engine).get_table_names()
        if "support_threads" not in table_names:
            conn.execute(
                text(
                    """
                    CREATE TABLE support_threads (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        telegram_user_id INTEGER NOT NULL UNIQUE,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                    """
                )
            )
        if "support_messages" not in table_names:
            conn.execute(
                text(
                    """
                    CREATE TABLE support_messages (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        thread_id INTEGER NOT NULL,
                        direction VARCHAR(8) NOT NULL,
                        text TEXT NOT NULL,
                        group_message_id INTEGER,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                    """
                )
            )
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_support_messages_thread ON support_messages (thread_id)"))
            conn.execute(
                text("CREATE INDEX IF NOT EXISTS ix_support_messages_group_msg ON support_messages (group_message_id)")
            )

        if "news_posts" in tables:
            if not _has_column(engine, "news_posts", "video_path"):
                conn.execute(text("ALTER TABLE news_posts ADD COLUMN video_path VARCHAR(256)"))
            for col, ddl in (
                ("link_url", "ALTER TABLE news_posts ADD COLUMN link_url VARCHAR(512)"),
                ("link_title", "ALTER TABLE news_posts ADD COLUMN link_title VARCHAR(300)"),
                ("link_description", "ALTER TABLE news_posts ADD COLUMN link_description TEXT"),
                ("link_image_url", "ALTER TABLE news_posts ADD COLUMN link_image_url VARCHAR(512)"),
                ("pinned", "ALTER TABLE news_posts ADD COLUMN pinned BOOLEAN DEFAULT 0"),
            ):
                if not _has_column(engine, "news_posts", col):
                    conn.execute(text(ddl))

        if "user_bybit_settings" not in inspect(engine).get_table_names():
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS user_bybit_settings (
                        telegram_user_id INTEGER PRIMARY KEY,
                        enabled BOOLEAN DEFAULT 1,
                        api_key_encrypted VARCHAR(512) NOT NULL,
                        api_secret_encrypted VARCHAR(512) NOT NULL,
                        testnet BOOLEAN DEFAULT 1,
                        account_balance_usd REAL DEFAULT 10000,
                        stake_percent REAL DEFAULT 10,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                    """
                )
            )

        if "signal_copy_trades" not in inspect(engine).get_table_names():
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS signal_copy_trades (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        signal_id INTEGER NOT NULL,
                        telegram_user_id INTEGER NOT NULL,
                        exchange_status VARCHAR(16),
                        exchange_pair VARCHAR(32),
                        exchange_qty REAL,
                        exchange_order_id VARCHAR(64),
                        exchange_error TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                    """
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_signal_copy_trades_signal_id "
                    "ON signal_copy_trades (signal_id)"
                )
            )
            conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ix_signal_copy_trades_signal_user "
                    "ON signal_copy_trades (signal_id, telegram_user_id)"
                )
            )

        if "user_bybit_settings" in inspect(engine).get_table_names():
            for col, ddl in (
                ("connected_at", "ALTER TABLE user_bybit_settings ADD COLUMN connected_at DATETIME"),
                ("equity_baseline_usd", "ALTER TABLE user_bybit_settings ADD COLUMN equity_baseline_usd REAL"),
                ("last_equity_usd", "ALTER TABLE user_bybit_settings ADD COLUMN last_equity_usd REAL"),
                ("billed_profit_usd", "ALTER TABLE user_bybit_settings ADD COLUMN billed_profit_usd REAL DEFAULT 0"),
            ):
                if not _has_column(engine, "user_bybit_settings", col):
                    conn.execute(text(ddl))
            conn.execute(text("UPDATE user_bybit_settings SET billed_profit_usd = 0 WHERE billed_profit_usd IS NULL"))

        if "copy_trading_invoices" not in inspect(engine).get_table_names():
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS copy_trading_invoices (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        telegram_user_id INTEGER NOT NULL,
                        period_date DATE NOT NULL,
                        profit_usd REAL NOT NULL,
                        fee_usd REAL NOT NULL,
                        status VARCHAR(16) DEFAULT 'pending',
                        tx_id VARCHAR(128) UNIQUE,
                        paid_at DATETIME,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                    """
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_copy_trading_invoices_user "
                    "ON copy_trading_invoices (telegram_user_id)"
                )
            )

        if "subscription_pause_days" not in inspect(engine).get_table_names():
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS subscription_pause_days (
                        msk_date VARCHAR(10) PRIMARY KEY,
                        signals_count INTEGER DEFAULT 0,
                        subscribers_extended INTEGER DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                    """
                )
            )

        if "cult_channels" not in inspect(engine).get_table_names():
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS cult_channels (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        title VARCHAR(128) NOT NULL,
                        username VARCHAR(64) NOT NULL UNIQUE,
                        chat_id INTEGER UNIQUE,
                        channel_url VARCHAR(256) NOT NULL,
                        connected_at DATETIME NOT NULL,
                        enabled BOOLEAN DEFAULT 1,
                        rating_percent REAL DEFAULT 0,
                        wins INTEGER DEFAULT 0,
                        losses INTEGER DEFAULT 0,
                        added_by_telegram_id INTEGER,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                    """
                )
            )
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_cult_channels_username ON cult_channels (username)"))

        if "cult_channel_signals" not in inspect(engine).get_table_names():
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS cult_channel_signals (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        cult_channel_id INTEGER NOT NULL,
                        telegram_message_id INTEGER NOT NULL,
                        message_date DATETIME NOT NULL,
                        symbol VARCHAR(32) NOT NULL,
                        direction VARCHAR(8) NOT NULL,
                        entry_low VARCHAR(32),
                        entry_high VARCHAR(32),
                        stop_loss VARCHAR(32),
                        take_profits TEXT,
                        status VARCHAR(16) DEFAULT 'active',
                        entry_filled_at DATETIME,
                        closed_at DATETIME,
                        close_reason VARCHAR(16),
                        closed_exit_price REAL,
                        published_market_price REAL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                    """
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_cult_channel_signals_channel "
                    "ON cult_channel_signals (cult_channel_id)"
                )
            )
            conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ix_cult_channel_signals_msg "
                    "ON cult_channel_signals (cult_channel_id, telegram_message_id)"
                )
            )

        if "cult_candidates" not in inspect(engine).get_table_names():
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS cult_candidates (
                        telegram_user_id INTEGER PRIMARY KEY,
                        display_name VARCHAR(64) NOT NULL,
                        enabled BOOLEAN DEFAULT 1,
                        joined_at DATETIME NOT NULL,
                        rating_percent REAL DEFAULT 0,
                        wins INTEGER DEFAULT 0,
                        losses INTEGER DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                    """
                )
            )

        if "trader_roster_overrides" not in inspect(engine).get_table_names():
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS trader_roster_overrides (
                        telegram_id INTEGER PRIMARY KEY,
                        section VARCHAR(16) NOT NULL,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                    """
                )
            )

    _backfill_referral_codes(engine)
    _purge_test_data_once(engine)
    _purge_signals_reset_v3(engine)
    _purge_all_published_may2026(engine)
    _purge_all_published_may2026_v2(engine)
    _purge_all_published_jun2026(engine)
    _purge_all_published_may2026_v3(engine)
    _purge_all_published_jun2026_v2(engine)
    _purge_all_published_jun2026_v3(engine)
    _purge_all_published_jun2026_v4(engine)
    _purge_all_published_jun2026_v5(engine)
    _purge_all_published_jun2026_v6(engine)
    _purge_all_published_jun2026_v7(engine)
    _purge_all_published_jun2026_v8(engine)
    _purge_all_published_jun2026_v9(engine)
    _disable_bybit_testnet_v1(engine)
    _backfill_payment_memos_v1(engine)
    _backfill_copy_billing_on_subscribers_v1(engine)
    _backfill_entry_notified_at_v1(engine)
    _sync_news_notify_flags_v1(engine)
    _reset_news_notify_opt_in_v2(engine)
    _recalc_market_close_ratings_v1(engine)
    _recalc_closed_signal_pnl_v2(engine)
    _recalc_closed_signal_pnl_v3(engine)
    _recalc_winrate_by_pnl_v1(engine)
    _seed_volnovoi_cult_launch_news_v1(engine)
    _seed_volnovoi_cult_launch_news_v2(engine)
    _backfill_pinned_launch_news_v1(engine)
    _purge_all_published_startup_v1(engine)
    _purge_all_published_jun2026_v10(engine)
    _purge_all_published_jun2026_v11(engine)


def _seed_launch_news(
    engine: Engine,
    *,
    marker_name: str,
) -> None:
    marker = _marker_path(engine, marker_name)
    if marker is None:
        from app.media_storage import media_root

        marker = media_root() / marker_name
    if marker.exists():
        return
    if "news_posts" not in inspect(engine).get_table_names():
        return

    from app.config import settings
    from app.database import SessionLocal
    from app.media_storage import media_root
    from app.models import NewsPost
    from app.news_launch import (
        LAUNCH_NEWS_BODY,
        LAUNCH_NEWS_TITLE,
        PENDING_NEWS_NOTIFY_FILE,
        copy_news_cover,
        launch_news_cover_path,
    )

    author_id = next(iter(sorted(settings.super_admin_id_set or settings.admin_id_set)), 1)
    cover = launch_news_cover_path()
    root = media_root()
    db = SessionLocal()
    try:
        row = NewsPost(
            title=LAUNCH_NEWS_TITLE[:200],
            body=LAUNCH_NEWS_BODY.strip()[:10000],
            author_telegram_id=author_id,
            pinned=True,
        )
        db.add(row)
        db.flush()
        if cover is not None:
            row.image_path = copy_news_cover(root, row.id, cover)
        db.commit()
        db.refresh(row)
        (root / PENDING_NEWS_NOTIFY_FILE).write_text(str(row.id), encoding="utf-8")
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.touch()
    finally:
        db.close()


def _seed_volnovoi_cult_launch_news_v1(engine: Engine) -> None:
    """Одноразово: короткая стартовая новость (июнь 2026)."""
    _seed_launch_news(engine, marker_name=".seeded_volnovoi_cult_launch_news_v1")


def _seed_volnovoi_cult_launch_news_v2(engine: Engine) -> None:
    """Одноразово: полная новость с новой обложкой + push после старта."""
    _seed_launch_news(engine, marker_name=".seeded_volnovoi_cult_launch_news_v2")


def _backfill_pinned_launch_news_v1(engine: Engine) -> None:
    """Закрепить стартовые новости Volnovoi Cult — не удаляются при purge."""
    marker = _marker_path(engine, ".backfill_pinned_launch_news_v1")
    if marker is None:
        from app.media_storage import media_root

        marker = media_root() / ".backfill_pinned_launch_news_v1"
    if marker.exists():
        return
    if "news_posts" not in inspect(engine).get_table_names():
        return
    if not _has_column(engine, "news_posts", "pinned"):
        return

    from app.news_launch import LAUNCH_NEWS_TITLE

    with engine.begin() as conn:
        conn.execute(
            text("UPDATE news_posts SET pinned = 1 WHERE title = :title"),
            {"title": LAUNCH_NEWS_TITLE[:200]},
        )
    marker.parent.mkdir(parents=True, exist_ok=True)
    marker.touch()


def _recalc_closed_signal_pnl_v3(engine: Engine) -> None:
    """P/L от размера счёта (account_size), не накопленного баланса; пересчёт ТОП и трекеров."""
    marker = _marker_path(engine, ".recalc_closed_signal_pnl_v3")
    if marker is None:
        from app.media_storage import media_root

        marker = media_root() / ".recalc_closed_signal_pnl_v3"
    if marker.exists():
        return

    from sqlalchemy import select

    from app.challenge_service import rebuild_tracker_balances_from_signals
    from app.config import settings
    from app.database import SessionLocal
    from app.models import Signal, UserChallenge
    from app.trader_stats import rebuild_trader_stats_from_signals

    ids = sorted(settings.all_admin_id_set)
    if not ids:
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.touch()
        return

    db = SessionLocal()
    try:
        for aid in ids:
            ch = db.get(UserChallenge, aid)
            acct = ch.account_size if ch is not None and ch.account_size > 0 else None
            if acct is None:
                continue
            for signal in db.scalars(select(Signal).where(Signal.author_telegram_id == aid)).all():
                if signal.account_size is None or signal.account_size <= 0:
                    signal.account_size = acct

        rebuild_trader_stats_from_signals(db, ids)
        rebuild_tracker_balances_from_signals(db, ids)
        db.commit()
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.touch()
    finally:
        db.close()


def _recalc_winrate_by_pnl_v1(engine: Engine) -> None:
    """WR и W/L в ТОП/трекере — по фактическому P/L ($), не только по статусу win/lose."""
    marker = _marker_path(engine, ".recalc_winrate_by_pnl_v1")
    if marker is None:
        from app.media_storage import media_root

        marker = media_root() / ".recalc_winrate_by_pnl_v1"
    if marker.exists():
        return

    from app.config import settings
    from app.database import SessionLocal
    from app.trader_stats import rebuild_trader_stats_from_signals

    ids = sorted(settings.all_admin_id_set)
    if not ids:
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.touch()
        return

    db = SessionLocal()
    try:
        rebuild_trader_stats_from_signals(db, ids)
        db.commit()
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.touch()
    finally:
        db.close()


def _recalc_closed_signal_pnl_v2(engine: Engine) -> None:
    """Пересчёт P/L: сумма входа из risk_percent, exit из closed_exit_price."""
    marker = _marker_path(engine, ".recalc_closed_signal_pnl_v2")
    if marker is None:
        from app.media_storage import media_root

        marker = media_root() / ".recalc_closed_signal_pnl_v2"
    if marker.exists():
        return

    from app.challenge_service import rebuild_tracker_balances_from_signals
    from app.config import settings
    from app.database import SessionLocal
    from app.trader_stats import rebuild_trader_stats_from_signals

    ids = sorted(settings.all_admin_id_set)
    if not ids:
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.touch()
        return

    db = SessionLocal()
    try:
        rebuild_trader_stats_from_signals(db, ids)
        rebuild_tracker_balances_from_signals(db, ids)
        db.commit()
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.touch()
    finally:
        db.close()


def _recalc_market_close_ratings_v1(engine: Engine) -> None:
    """Пересчёт рейтинга/PnL по фактической цене закрытия (fix market close)."""
    marker = _marker_path(engine, ".recalc_market_close_ratings_v1")
    if marker is None:
        from app.media_storage import media_root

        marker = media_root() / ".recalc_market_close_ratings_v1"
    if marker.exists():
        return

    from app.challenge_service import rebuild_tracker_balances_from_signals
    from app.config import settings
    from app.database import SessionLocal
    from app.trader_stats import rebuild_trader_stats_from_signals

    ids = sorted(settings.all_admin_id_set)
    if not ids:
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.touch()
        return

    db = SessionLocal()
    try:
        rebuild_trader_stats_from_signals(db, ids)
        rebuild_tracker_balances_from_signals(db, ids)
        db.commit()
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.touch()
    finally:
        db.close()


def _purge_signals_reset_v3(engine: Engine) -> None:
    """Одноразово: удалить все сигналы и обнулить рейтинг (май 2026)."""
    marker = _marker_path(engine, ".purged_reset_v3")
    if marker is None:
        from app.media_storage import media_root

        marker = media_root() / ".purged_reset_v3"
    if marker.exists():
        return
    from app.database import SessionLocal
    from app.data_cleanup import purge_signals_and_reset_ratings

    db = SessionLocal()
    try:
        purge_signals_and_reset_ratings(db)
        db.commit()
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.touch()
    finally:
        db.close()


def _backfill_referral_codes(engine: Engine) -> None:
    if not str(engine.url).startswith("sqlite"):
        return
    if "subscribers" not in inspect(engine).get_table_names():
        return
    import secrets
    import string

    from app.database import SessionLocal

    alphabet = string.ascii_uppercase + string.digits
    db = SessionLocal()
    try:
        rows = db.execute(text("SELECT telegram_user_id FROM subscribers WHERE referral_code IS NULL OR referral_code = ''")).fetchall()
        for (tid,) in rows:
            for _ in range(30):
                code = "".join(secrets.choice(alphabet) for _ in range(8))
                clash = db.execute(text("SELECT 1 FROM subscribers WHERE referral_code = :c"), {"c": code}).fetchone()
                if not clash:
                    db.execute(text("UPDATE subscribers SET referral_code = :c WHERE telegram_user_id = :t"), {"c": code, "t": tid})
                    break
        db.commit()
    finally:
        db.close()


def _purge_all_published_may2026(engine: Engine) -> None:
    """Одноразово: сигналы, новости, отзывы и сброс рейтинга/трекеров (май 2026)."""
    marker = _marker_path(engine, ".purged_all_published_may2026")
    if marker is None:
        from app.media_storage import media_root

        marker = media_root() / ".purged_all_published_may2026"
    if marker.exists():
        return
    from app.database import SessionLocal
    from app.data_cleanup import purge_all_published_content

    db = SessionLocal()
    try:
        purge_all_published_content(db)
        db.commit()
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.touch()
    finally:
        db.close()


def _purge_all_published_may2026_v2(engine: Engine) -> None:
    """Одноразово: повторная очистка сигналов, новостей и отзывов (май 2026)."""
    marker = _marker_path(engine, ".purged_all_published_may2026_v2")
    if marker is None:
        from app.media_storage import media_root

        marker = media_root() / ".purged_all_published_may2026_v2"
    if marker.exists():
        return
    from app.database import SessionLocal
    from app.data_cleanup import purge_all_published_content

    db = SessionLocal()
    try:
        purge_all_published_content(db)
        db.commit()
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.touch()
    finally:
        db.close()


def _purge_all_published_jun2026(engine: Engine) -> None:
    """Одноразово: сигналы, новости, отзывы и сброс рейтинга/трекеров (июнь 2026)."""
    marker = _marker_path(engine, ".purged_all_published_jun2026")
    if marker is None:
        from app.media_storage import media_root

        marker = media_root() / ".purged_all_published_jun2026"
    if marker.exists():
        return
    from app.database import SessionLocal
    from app.data_cleanup import purge_all_published_content

    db = SessionLocal()
    try:
        purge_all_published_content(db)
        db.commit()
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.touch()
    finally:
        db.close()


def _purge_all_published_jun2026_v2(engine: Engine) -> None:
    """Одноразово: полная очистка опубликованного контента (июнь 2026 v2)."""
    marker = _marker_path(engine, ".purged_all_published_jun2026_v2")
    if marker is None:
        from app.media_storage import media_root

        marker = media_root() / ".purged_all_published_jun2026_v2"
    if marker.exists():
        return
    from app.database import SessionLocal
    from app.data_cleanup import purge_all_published_content

    db = SessionLocal()
    try:
        purge_all_published_content(db)
        db.commit()
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.touch()
    finally:
        db.close()


def _purge_all_published_jun2026_v3(engine: Engine) -> None:
    """Одноразово: полная очистка контента + сброс stats кандидатов CULT (июнь 2026 v3)."""
    marker = _marker_path(engine, ".purged_all_published_jun2026_v3")
    if marker is None:
        from app.media_storage import media_root

        marker = media_root() / ".purged_all_published_jun2026_v3"
    if marker.exists():
        return
    from app.database import SessionLocal
    from app.data_cleanup import purge_all_published_content

    db = SessionLocal()
    try:
        purge_all_published_content(db)
        db.commit()
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.touch()
    finally:
        db.close()


def _purge_all_published_jun2026_v4(engine: Engine) -> None:
    """Одноразово: полная очистка опубликованного контента (июнь 2026 v4)."""
    marker = _marker_path(engine, ".purged_all_published_jun2026_v4")
    if marker is None:
        from app.media_storage import media_root

        marker = media_root() / ".purged_all_published_jun2026_v4"
    if marker.exists():
        return
    from app.database import SessionLocal
    from app.data_cleanup import purge_all_published_content

    db = SessionLocal()
    try:
        purge_all_published_content(db)
        db.commit()
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.touch()
    finally:
        db.close()


def _purge_all_published_jun2026_v5(engine: Engine) -> None:
    """Одноразово: полная очистка опубликованного контента (июнь 2026 v5)."""
    marker = _marker_path(engine, ".purged_all_published_jun2026_v5")
    if marker is None:
        from app.media_storage import media_root

        marker = media_root() / ".purged_all_published_jun2026_v5"
    if marker.exists():
        return
    from app.database import SessionLocal
    from app.data_cleanup import purge_all_published_content

    db = SessionLocal()
    try:
        purge_all_published_content(db)
        db.commit()
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.touch()
    finally:
        db.close()


def _purge_all_published_jun2026_v6(engine: Engine) -> None:
    """Одноразово: полная очистка опубликованного контента (июнь 2026 v6)."""
    marker = _marker_path(engine, ".purged_all_published_jun2026_v6")
    if marker is None:
        from app.media_storage import media_root

        marker = media_root() / ".purged_all_published_jun2026_v6"
    if marker.exists():
        return
    from app.database import SessionLocal
    from app.data_cleanup import purge_all_published_content

    db = SessionLocal()
    try:
        purge_all_published_content(db)
        db.commit()
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.touch()
    finally:
        db.close()


def _purge_all_published_jun2026_v7(engine: Engine) -> None:
    """Одноразово: полная очистка опубликованного контента + сброс ротации трейдеров (июнь 2026 v7)."""
    marker = _marker_path(engine, ".purged_all_published_jun2026_v7")
    if marker is None:
        from app.media_storage import media_root

        marker = media_root() / ".purged_all_published_jun2026_v7"
    if marker.exists():
        return
    from app.database import SessionLocal
    from app.data_cleanup import purge_all_published_content

    db = SessionLocal()
    try:
        purge_all_published_content(db)
        db.commit()
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.touch()
    finally:
        db.close()


def _purge_all_published_jun2026_v8(engine: Engine) -> None:
    """Одноразово: полная очистка опубликованного контента (июнь 2026 v8)."""
    marker = _marker_path(engine, ".purged_all_published_jun2026_v8")
    if marker is None:
        from app.media_storage import media_root

        marker = media_root() / ".purged_all_published_jun2026_v8"
    if marker.exists():
        return
    from app.database import SessionLocal
    from app.data_cleanup import purge_all_published_content

    db = SessionLocal()
    try:
        purge_all_published_content(db)
        db.commit()
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.touch()
    finally:
        db.close()


def _purge_all_published_jun2026_v9(engine: Engine) -> None:
    """Одноразово: полная очистка опубликованного контента (июнь 2026 v9)."""
    marker = _marker_path(engine, ".purged_all_published_jun2026_v9")
    if marker is None:
        from app.media_storage import media_root

        marker = media_root() / ".purged_all_published_jun2026_v9"
    if marker.exists():
        return
    from app.database import SessionLocal
    from app.data_cleanup import purge_all_published_content

    db = SessionLocal()
    try:
        purge_all_published_content(db)
        db.commit()
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.touch()
    finally:
        db.close()


def _purge_all_published_jun2026_v10(engine: Engine) -> None:
    """Одноразово: полная очистка опубликованного контента (июнь 2026 v10)."""
    marker = _marker_path(engine, ".purged_all_published_jun2026_v10")
    if marker is None:
        from app.media_storage import media_root

        marker = media_root() / ".purged_all_published_jun2026_v10"
    if marker.exists():
        return
    from app.database import SessionLocal
    from app.data_cleanup import purge_all_published_content

    db = SessionLocal()
    try:
        purge_all_published_content(db)
        db.commit()
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.touch()
    finally:
        db.close()


def _purge_all_published_jun2026_v11(engine: Engine) -> None:
    """Одноразово: полная очистка опубликованного контента (июнь 2026 v11)."""
    marker = _marker_path(engine, ".purged_all_published_jun2026_v11")
    if marker is None:
        from app.media_storage import media_root

        marker = media_root() / ".purged_all_published_jun2026_v11"
    if marker.exists():
        return
    from app.database import SessionLocal
    from app.data_cleanup import purge_all_published_content

    db = SessionLocal()
    try:
        purge_all_published_content(db)
        db.commit()
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.touch()
    finally:
        db.close()


def _backfill_entry_notified_at_v1(engine: Engine) -> None:
    """Старые входы по лимитке не дублируем push «В РЫНКЕ» после деплоя."""
    marker = _marker_path(engine, ".backfill_entry_notified_at_v1")
    if marker is None:
        from app.media_storage import media_root

        marker = media_root() / ".backfill_entry_notified_at_v1"
    if marker.exists():
        return
    if "signals" not in inspect(engine).get_table_names():
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.touch()
        return
    with engine.begin() as conn:
        conn.execute(
            text(
                "UPDATE signals SET entry_notified_at = entry_filled_at "
                "WHERE entry_filled_at IS NOT NULL AND entry_notified_at IS NULL"
            )
        )
    marker.parent.mkdir(parents=True, exist_ok=True)
    marker.touch()


def _backfill_copy_billing_on_subscribers_v1(engine: Engine) -> None:
    """Перенос baseline/billed/connected с user_bybit_settings на subscribers."""
    marker = _marker_path(engine, ".backfill_copy_billing_on_subscribers_v1")
    if marker is None:
        from app.media_storage import media_root

        marker = media_root() / ".backfill_copy_billing_on_subscribers_v1"
    if marker.exists():
        return
    if not str(engine.url).startswith("sqlite"):
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.touch()
        return
    if "user_bybit_settings" not in inspect(engine).get_table_names():
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.touch()
        return

    from app.database import SessionLocal

    db = SessionLocal()
    try:
        rows = db.execute(
            text(
                """
                SELECT telegram_user_id, equity_baseline_usd, billed_profit_usd, connected_at
                FROM user_bybit_settings
                """
            )
        ).fetchall()
        for tid, baseline, billed, connected_at in rows:
            db.execute(
                text(
                    """
                    UPDATE subscribers
                    SET
                        copy_equity_baseline_usd = COALESCE(copy_equity_baseline_usd, :baseline),
                        copy_billed_profit_usd = CASE
                            WHEN copy_billed_profit_usd IS NULL OR copy_billed_profit_usd = 0
                            THEN COALESCE(:billed, 0)
                            ELSE copy_billed_profit_usd
                        END,
                        copy_connected_at = COALESCE(copy_connected_at, :connected_at)
                    WHERE telegram_user_id = :tid
                    """
                ),
                {
                    "tid": tid,
                    "baseline": baseline,
                    "billed": billed or 0,
                    "connected_at": connected_at,
                },
            )
        db.commit()
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.touch()
    finally:
        db.close()


def _backfill_payment_memos_v1(engine: Engine) -> None:
    """Персональные VC-коды для привязки USDT-платежей к пользователю."""
    marker = _marker_path(engine, ".backfill_payment_memos_v1")
    if marker is None:
        from app.media_storage import media_root

        marker = media_root() / ".backfill_payment_memos_v1"
    if marker.exists():
        return
    if "subscribers" not in inspect(engine).get_table_names():
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.touch()
        return
    from app.database import SessionLocal
    from app.models import Subscriber
    from app.subscription_billing import ensure_payment_memo
    from sqlalchemy import select

    db = SessionLocal()
    try:
        subs = list(db.scalars(select(Subscriber).where(Subscriber.payment_memo.is_(None))).all())
        for sub in subs:
            ensure_payment_memo(db, sub)
        db.commit()
        with engine.begin() as conn:
            conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ix_subscribers_payment_memo "
                    "ON subscribers (payment_memo)"
                )
            )
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.touch()
    finally:
        db.close()


def _disable_bybit_testnet_v1(engine: Engine) -> None:
    """Одноразово: только основной Bybit — сброс testnet у сохранённых API-ключей."""
    marker = _marker_path(engine, ".disabled_bybit_testnet_v1")
    if marker is None:
        from app.media_storage import media_root

        marker = media_root() / ".disabled_bybit_testnet_v1"
    if marker.exists():
        return
    insp = inspect(engine)
    if "user_bybit_settings" not in insp.get_table_names():
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.touch()
        return
    with engine.begin() as conn:
        conn.execute(text("UPDATE user_bybit_settings SET testnet = 0"))
    marker.parent.mkdir(parents=True, exist_ok=True)
    marker.touch()


def _purge_all_published_startup_v1(engine: Engine) -> None:
    """Одноразово при следующем запуске: сигналы, CULT, отзывы, новости (кроме pinned)."""
    marker = _marker_path(engine, ".purged_all_published_startup_v1")
    if marker is None:
        from app.media_storage import media_root

        marker = media_root() / ".purged_all_published_startup_v1"
    if marker.exists():
        return
    from app.database import SessionLocal
    from app.data_cleanup import purge_all_published_content

    db = SessionLocal()
    try:
        purge_all_published_content(db)
        db.commit()
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.touch()
    finally:
        db.close()


def _purge_all_published_may2026_v3(engine: Engine) -> None:
    """Одноразово: полная очистка контента incl. CULT (май 2026 v3)."""
    marker = _marker_path(engine, ".purged_all_published_may2026_v3")
    if marker is None:
        from app.media_storage import media_root

        marker = media_root() / ".purged_all_published_may2026_v3"
    if marker.exists():
        return
    from app.database import SessionLocal
    from app.data_cleanup import purge_all_published_content

    db = SessionLocal()
    try:
        purge_all_published_content(db)
        db.commit()
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.touch()
    finally:
        db.close()


def _sync_news_notify_flags_v1(engine: Engine) -> None:
    """Сброс notify_news у подписчиков без оплаты (trial / без подписки)."""
    marker = _marker_path(engine, ".synced_news_notify_v1")
    if marker is None:
        from app.media_storage import media_root

        marker = media_root() / ".synced_news_notify_v1"
    if marker.exists():
        return
    marker.parent.mkdir(parents=True, exist_ok=True)
    marker.touch()


def _reset_news_notify_opt_in_v2(engine: Engine) -> None:
    """Сброс notify_news у всех — повторное включение только вручную на вкладке «Новости» после оплаты."""
    marker = _marker_path(engine, ".reset_news_notify_v2")
    if marker is None:
        from app.media_storage import media_root

        marker = media_root() / ".reset_news_notify_v2"
    if marker.exists():
        return
    with engine.begin() as conn:
        conn.execute(text("UPDATE subscribers SET notify_news_enabled = 0"))
    marker.parent.mkdir(parents=True, exist_ok=True)
    marker.touch()


def _purge_test_data_once(engine: Engine) -> None:
    marker = _marker_path(engine, ".purged_test_v2")
    if marker is None or marker.exists():
        return
    from app.database import SessionLocal
    from app.data_cleanup import purge_all_signals

    db = SessionLocal()
    try:
        purge_all_signals(db)
        db.commit()
        marker.touch()
    finally:
        db.close()
