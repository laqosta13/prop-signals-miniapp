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
                ("views_count", "ALTER TABLE signals ADD COLUMN views_count INTEGER DEFAULT 0"),
                ("likes_count", "ALTER TABLE signals ADD COLUMN likes_count INTEGER DEFAULT 0"),
            ):
                if not _has_column(engine, "signals", col):
                    conn.execute(text(ddl))
            conn.execute(text("UPDATE signals SET points_percent = 1.0 WHERE points_percent IS NULL"))
            conn.execute(text("UPDATE signals SET views_count = 0 WHERE views_count IS NULL"))
            conn.execute(text("UPDATE signals SET likes_count = 0 WHERE likes_count IS NULL"))

        if "traders" in tables:
            if not _has_column(engine, "traders", "avatar_path"):
                conn.execute(text("ALTER TABLE traders ADD COLUMN avatar_path VARCHAR(256)"))
            if not _has_column(engine, "traders", "total_pnl_usd"):
                conn.execute(text("ALTER TABLE traders ADD COLUMN total_pnl_usd REAL DEFAULT 0"))
            conn.execute(text("UPDATE traders SET wins = 0 WHERE wins IS NULL"))
            conn.execute(text("UPDATE traders SET losses = 0 WHERE losses IS NULL"))
            conn.execute(text("UPDATE traders SET rating_percent = 0.0 WHERE rating_percent IS NULL"))
            conn.execute(text("UPDATE traders SET total_pnl_usd = 0 WHERE total_pnl_usd IS NULL"))

    _purge_test_data_once(engine)


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
