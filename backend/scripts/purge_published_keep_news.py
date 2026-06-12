#!/usr/bin/env python3
"""Очистка контента без новостей (только stdlib: sqlite3 + shutil)."""

from __future__ import annotations

import argparse
import os
import shutil
import sqlite3
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
INITIAL_RANK_ID = 7


def _load_dotenv() -> None:
    env_path = BACKEND / ".env"
    if not env_path.is_file():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


def _db_path_from_env(explicit: str | None) -> Path:
    if explicit:
        return Path(explicit).resolve()
    url = os.environ.get("DATABASE_URL", "sqlite:///./signals.db")
    if url.startswith("sqlite:///"):
        rel = url.removeprefix("sqlite:///")
        p = Path(rel)
        return p if p.is_absolute() else (BACKEND / p).resolve()
    raise SystemExit(f"Поддерживается только sqlite, получено: {url}")


def _media_root() -> Path:
    raw = os.environ.get("MEDIA_ROOT", "./media")
    p = Path(raw)
    return p if p.is_absolute() else (BACKEND / p).resolve()


def _clear_subdir(root: Path, name: str) -> None:
    path = root / name
    if path.is_dir():
        shutil.rmtree(path, ignore_errors=True)
    path.mkdir(parents=True, exist_ok=True)


def _delete_files(root: Path, *paths: str | None) -> None:
    for rel in paths:
        if not rel:
            continue
        target = Path(rel) if Path(rel).is_absolute() else root / rel
        if target.is_file():
            target.unlink(missing_ok=True)


def purge(db_path: Path, media: Path) -> dict[str, int]:
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    def count(table: str) -> int:
        cur.execute(f"SELECT COUNT(*) FROM {table}")
        return int(cur.fetchone()[0])

    counts = {
        "signals_deleted": count("signals"),
        "reviews_deleted": count("reviews"),
        "cult_channel_signals_deleted": count("cult_channel_signals"),
        "news_posts_kept": count("news_posts"),
    }

    for row in cur.execute("SELECT media_image_path, media_video_path FROM signals"):
        _delete_files(media, row[0], row[1])
    for row in cur.execute("SELECT media_image_path, media_video_path FROM signal_supplements"):
        _delete_files(media, row[0], row[1])
    _clear_subdir(media, "signals")

    for table in (
        "signal_copy_trades",
        "signal_likes",
        "signal_views",
        "signal_supplements",
        "signals",
        "cult_channel_signals",
    ):
        cur.execute(f"DELETE FROM {table}")

    for row in cur.execute("SELECT image_path FROM reviews"):
        _delete_files(media, row[0])
    _clear_subdir(media, "reviews")
    cur.execute("DELETE FROM reviews")

    cur.execute("UPDATE cult_channels SET rating_percent = 0, wins = 0, losses = 0")
    cur.execute("UPDATE cult_candidates SET rating_percent = 0, wins = 0, losses = 0")
    cur.execute(
        """
        UPDATE traders SET
          wins = 0,
          losses = 0,
          rating_percent = 0,
          total_pnl_usd = 0,
          current_rank_id = ?,
          weekly_pct = 0,
          is_confirmed = 0,
          confirm_deadline = NULL,
          consecutive_loss_weeks = 0,
          shield_used_this_month = 0,
          shield_active = 0,
          rank_applied_this_week = 0,
          rank_history_json = NULL
        """,
        (INITIAL_RANK_ID,),
    )
    cur.execute("DELETE FROM trader_roster_overrides")

    for row in cur.execute("SELECT telegram_user_id, prop_screenshot_path FROM user_challenges"):
        aid, screenshot = row[0], row[1]
        _delete_files(media, screenshot)
        tracker_dir = media / "trackers" / str(aid)
        if tracker_dir.is_dir():
            shutil.rmtree(tracker_dir, ignore_errors=True)
    cur.execute("DELETE FROM user_challenges")

    conn.commit()
    conn.close()
    return counts


def main() -> None:
    _load_dotenv()
    parser = argparse.ArgumentParser(description="Очистить опубликованный контент, кроме новостей")
    parser.add_argument("--db", help="Путь к SQLite (иначе DATABASE_URL из .env)")
    parser.add_argument("--dry-run", action="store_true", help="Только показать счётчики")
    args = parser.parse_args()

    db_path = _db_path_from_env(args.db)
    if not db_path.is_file():
        print(f"База не найдена: {db_path}", file=sys.stderr)
        sys.exit(1)

    if args.dry_run:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        for t in ("signals", "reviews", "cult_channel_signals", "news_posts"):
            cur.execute(f"SELECT COUNT(*) FROM {t}")
            print(f"{t}: {cur.fetchone()[0]}")
        conn.close()
        return

    counts = purge(db_path, _media_root())
    print("Готово (новости сохранены):")
    for k, v in counts.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
