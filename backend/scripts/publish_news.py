#!/usr/bin/env python3
"""Публикация новости с обложкой (как POST /news, без HTTP)."""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import models  # noqa: F401
from app.config import settings
from app.database import Base, SessionLocal, engine
from app.migrate import run_migrations
from app.models import NewsPost
from app.news_launch import (
    LAUNCH_NEWS_BODY,
    LAUNCH_NEWS_TITLE,
    copy_news_cover,
    launch_news_cover_path,
)


def _media_root() -> Path:
    root = Path(settings.media_root)
    root.mkdir(parents=True, exist_ok=True)
    (root / "news").mkdir(exist_ok=True)
    return root


async def _maybe_notify(db, row: NewsPost, *, notify: bool) -> None:
    if notify:
        from app.signal_service import notify_new_news

        await notify_new_news(db, row)


def publish(
    *,
    title: str,
    body: str,
    image: Path | None,
    author_id: int,
    notify: bool,
) -> NewsPost:
    Base.metadata.create_all(bind=engine)
    run_migrations(engine)
    root = _media_root()
    db = SessionLocal()
    try:
        row = NewsPost(
            title=title.strip()[:200],
            body=body.strip()[:10000],
            author_telegram_id=author_id,
            pinned=title.strip() == LAUNCH_NEWS_TITLE,
        )
        db.add(row)
        db.flush()
        if image is not None:
            if not image.is_file():
                raise FileNotFoundError(image)
            row.image_path = copy_news_cover(root, row.id, image)
        db.commit()
        db.refresh(row)
        asyncio.run(_maybe_notify(db, row, notify=notify))
        return row
    finally:
        db.close()


def main() -> None:
    default_image = launch_news_cover_path()

    parser = argparse.ArgumentParser(description="Опубликовать новость в БД")
    parser.add_argument("--title", default=LAUNCH_NEWS_TITLE)
    parser.add_argument("--body", default=LAUNCH_NEWS_BODY)
    parser.add_argument("--image", type=Path, default=default_image)
    parser.add_argument("--author-id", type=int, default=1)
    parser.add_argument("--no-notify", action="store_true")
    args = parser.parse_args()

    row = publish(
        title=args.title,
        body=args.body,
        image=args.image if args.image and str(args.image) != "none" else None,
        author_id=args.author_id,
        notify=not args.no_notify,
    )
    print(f"Опубликовано: id={row.id} title={row.title!r}")
    if row.image_path:
        print(f"Обложка: {row.image_path}")


if __name__ == "__main__":
    main()
