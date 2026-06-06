"""Текст и обложка стартовой новости Volnovoi Cult."""

from __future__ import annotations

import shutil
from pathlib import Path

LAUNCH_NEWS_TITLE = "Volnovoi Cult — то, чего ещё не было на рынке"

LAUNCH_NEWS_BODY = """Раньше — красивые обещания и тишина, когда рынок пошёл не туда.

Volnovoi Cult — витрина живого рынка. Не канал. Не «поверь нам». Смотри сам: кто в сделке, кто закрылся, кто растёт.

Что внутри:
— лента: активные и закрытые сделки отдельно, как на радаре
— ТОП: трейдеры Cult и кандидаты — отбор на виду
— карточка кандидата: твоя сцена, свои сделки, те же ранги и правила
— 30 дней всё бесплатно — тест без риска

Такого формата ещё не было. Мы его собрали.

Заходи. Смотри. Решай сам.

Volnovoi Cult · marketplace крипто-сделок
Это только начало."""

PENDING_NEWS_NOTIFY_FILE = ".pending_news_notify_id"
SEED_MARKER = ".seeded_volnovoi_cult_launch_news_v1"


def launch_news_cover_path() -> Path | None:
    for path in (
        Path("/app/news-assets/news-cover-volnovoi-cult.png"),
        Path(__file__).resolve().parents[2] / "docs/news-assets/news-cover-volnovoi-cult.png",
        Path(__file__).resolve().parents[2] / "docs/news-assets/news-update-june-2026.png",
    ):
        if path.is_file():
            return path
    return None


def copy_news_cover(media_root: Path, post_id: int, image_path: Path) -> str:
    ext = image_path.suffix.lower()
    folder = media_root / "news" / str(post_id)
    folder.mkdir(parents=True, exist_ok=True)
    rel = f"news/{post_id}/cover{ext}"
    shutil.copy2(image_path, media_root / rel)
    return rel
