from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.config import settings

IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
VIDEO_TYPES = {"video/mp4", "video/webm", "video/quicktime"}
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
VIDEO_EXT = {".mp4", ".webm", ".mov"}


def media_root() -> Path:
    root = Path(settings.media_root)
    root.mkdir(parents=True, exist_ok=True)
    (root / "signals").mkdir(exist_ok=True)
    (root / "avatars").mkdir(exist_ok=True)
    return root


def public_url(relative: str | None) -> str | None:
    if not relative:
        return None
    return f"/media/{relative.lstrip('/')}"


async def save_signal_image(signal_id: int, file: UploadFile) -> str:
    return await _save_upload(file, f"signals/{signal_id}", IMAGE_TYPES, IMAGE_EXT, settings.max_image_bytes, "screenshot")


async def save_signal_video(signal_id: int, file: UploadFile) -> str:
    return await _save_upload(file, f"signals/{signal_id}", VIDEO_TYPES, VIDEO_EXT, settings.max_video_bytes, "video")


async def _save_upload(
    file: UploadFile,
    subdir: str,
    allowed_types: set[str],
    allowed_ext: set[str],
    max_bytes: int,
    prefix: str,
) -> str:
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Пустой файл")
    ext = Path(file.filename).suffix.lower()
    if ext not in allowed_ext:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Недопустимое расширение: {ext}")
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if content_type and content_type not in allowed_types and content_type != "application/octet-stream":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Недопустимый тип: {content_type}")

    data = await file.read()
    if len(data) > max_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Файл слишком большой")
    if len(data) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Пустой файл")

    folder = media_root() / subdir
    folder.mkdir(parents=True, exist_ok=True)
    name = f"{prefix}_{uuid.uuid4().hex[:12]}{ext}"
    path = folder / name
    path.write_bytes(data)
    return f"{subdir}/{name}"


def save_avatar_bytes(telegram_id: int, data: bytes, ext: str = ".jpg") -> str:
    folder = media_root() / "avatars"
    rel = f"avatars/{telegram_id}{ext}"
    (folder / f"{telegram_id}{ext}").write_bytes(data)
    return rel


def delete_media_files(*paths: str | None) -> None:
    root = media_root()
    for rel in paths:
        if not rel:
            continue
        p = root / rel
        if p.is_file():
            p.unlink(missing_ok=True)


def delete_signal_media_dir(signal_id: int) -> None:
    folder = media_root() / "signals" / str(signal_id)
    if folder.is_dir():
        for f in folder.iterdir():
            if f.is_file():
                f.unlink(missing_ok=True)
