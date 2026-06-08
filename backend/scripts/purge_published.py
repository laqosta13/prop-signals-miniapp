#!/usr/bin/env python3
"""Ручная очистка опубликованного контента."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import models  # noqa: F401
from app.data_cleanup import purge_all_published_content, purge_published_except_news
from app.database import SessionLocal, engine
from app.media_storage import media_root
from app.migrate import run_migrations

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Очистка опубликованного контента")
    parser.add_argument(
        "--keep-news",
        action="store_true",
        help="Не удалять новости (сигналы, CULT, отзывы и сброс статистики — да)",
    )
    args = parser.parse_args()

    run_migrations(engine)
    media_root()
    db = SessionLocal()
    try:
        if args.keep_news:
            purge_published_except_news(db)
            msg = (
                "Готово: удалены сигналы, CULT-сигналы и отзывы; новости сохранены; "
                "сброшены рейтинг, CULT-статистика и трекеры."
            )
        else:
            purge_all_published_content(db)
            msg = (
                "Готово: удалены сигналы, CULT-сигналы, новости, отзывы; "
                "сброшены рейтинг, CULT-статистика и трекеры."
            )
        db.commit()
        print(msg)
    finally:
        db.close()
