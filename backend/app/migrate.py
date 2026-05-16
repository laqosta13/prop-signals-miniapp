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
