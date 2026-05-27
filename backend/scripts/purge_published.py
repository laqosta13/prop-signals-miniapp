#!/usr/bin/env python3
"""Ручная очистка всего опубликованного контента (сигналы, новости, отзывы)."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import models  # noqa: F401
from app.data_cleanup import purge_all_published_content
from app.database import SessionLocal, engine
from app.media_storage import media_root
from app.migrate import run_migrations

if __name__ == "__main__":
    run_migrations(engine)
    media_root()
    db = SessionLocal()
    try:
        purge_all_published_content(db)
        db.commit()
        print("Готово: удалены сигналы, новости, отзывы; сброшены рейтинг и трекеры.")
    finally:
        db.close()
