"""Лёгкие миграции SQLite без Alembic (добавление колонок в существующую БД)."""

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def _has_column(engine: Engine, table: str, column: str) -> bool:
    insp = inspect(engine)
    if table not in insp.get_table_names():
        return False
    return column in {c["name"] for c in insp.get_columns(table)}


def run_migrations(engine: Engine) -> None:
    with engine.begin() as conn:
        if not _has_column(engine, "signals", "closed_at"):
            conn.execute(text("ALTER TABLE signals ADD COLUMN closed_at DATETIME"))
        if not _has_column(engine, "signals", "points_percent"):
            conn.execute(text("ALTER TABLE signals ADD COLUMN points_percent REAL DEFAULT 1.0"))
        if not _has_column(engine, "signals", "author_username"):
            conn.execute(text("ALTER TABLE signals ADD COLUMN author_username VARCHAR(64)"))

        if "traders" in inspect(engine).get_table_names():
            conn.execute(text("UPDATE traders SET wins = 0 WHERE wins IS NULL"))
            conn.execute(text("UPDATE traders SET losses = 0 WHERE losses IS NULL"))
            conn.execute(text("UPDATE traders SET rating_percent = 0.0 WHERE rating_percent IS NULL"))
        if "signals" in inspect(engine).get_table_names():
            conn.execute(text("UPDATE signals SET points_percent = 1.0 WHERE points_percent IS NULL"))
            if not _has_column(engine, "signals", "leverage"):
                conn.execute(text("ALTER TABLE signals ADD COLUMN leverage INTEGER"))
            if not _has_column(engine, "signals", "risk_percent"):
                conn.execute(text("ALTER TABLE signals ADD COLUMN risk_percent REAL"))
            if not _has_column(engine, "signals", "realized_pnl"):
                conn.execute(text("ALTER TABLE signals ADD COLUMN realized_pnl REAL"))
            if not _has_column(engine, "signals", "media_image_path"):
                conn.execute(text("ALTER TABLE signals ADD COLUMN media_image_path VARCHAR(256)"))
            if not _has_column(engine, "signals", "media_video_path"):
                conn.execute(text("ALTER TABLE signals ADD COLUMN media_video_path VARCHAR(256)"))
        if "traders" in inspect(engine).get_table_names():
            if not _has_column(engine, "traders", "avatar_path"):
                conn.execute(text("ALTER TABLE traders ADD COLUMN avatar_path VARCHAR(256)"))
            if not _has_column(engine, "traders", "total_pnl_usd"):
                conn.execute(text("ALTER TABLE traders ADD COLUMN total_pnl_usd REAL DEFAULT 0"))
            conn.execute(text("UPDATE traders SET total_pnl_usd = 0 WHERE total_pnl_usd IS NULL"))
        if "signals" in inspect(engine).get_table_names():
            if not _has_column(engine, "signals", "tracker_balance"):
                conn.execute(text("ALTER TABLE signals ADD COLUMN tracker_balance REAL"))
            if not _has_column(engine, "signals", "views_count"):
                conn.execute(text("ALTER TABLE signals ADD COLUMN views_count INTEGER DEFAULT 0"))
            if not _has_column(engine, "signals", "likes_count"):
                conn.execute(text("ALTER TABLE signals ADD COLUMN likes_count INTEGER DEFAULT 0"))
            conn.execute(text("UPDATE signals SET views_count = 0 WHERE views_count IS NULL"))
            conn.execute(text("UPDATE signals SET likes_count = 0 WHERE likes_count IS NULL"))

    _replay_admin_trackers_once(engine)


def _replay_admin_trackers_once(engine: Engine) -> None:
    from pathlib import Path

    from app.database import SessionLocal
    from app.challenge_service import replay_trackers_from_closed_signals

    db_url = str(engine.url)
    if db_url.startswith("sqlite"):
        db_file = engine.url.database
        if not db_file or db_file == ":memory:":
            return
        marker = Path(db_file).resolve().parent / ".tracker_replay_v1"
    else:
        return
    if marker.exists():
        return
    db = SessionLocal()
    try:
        replay_trackers_from_closed_signals(db)
        db.commit()
        marker.touch()
    finally:
        db.close()
