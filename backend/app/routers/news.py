from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import db_session, get_current_user, require_admin
from app.link_preview import fetch_link_preview, normalize_link_url
from app.media_storage import delete_media_files, save_news_image, save_news_video
from app.models import NewsPost
from app.schemas import NewsLinkPreview, NewsRead, TelegramUser
from app.serializers import news_to_read
from app.signal_service import notify_new_news

router = APIRouter(prefix="/news", tags=["news"])


def _apply_link(row: NewsPost, preview) -> None:
    row.link_url = preview.url
    row.link_title = preview.title
    row.link_description = preview.description
    row.link_image_url = preview.image_url


def _clear_link(row: NewsPost) -> None:
    row.link_url = None
    row.link_title = None
    row.link_description = None
    row.link_image_url = None


async def _parse_link_url(raw: str | None) -> LinkPreview | None:
    cleaned = (raw or "").strip()
    if not cleaned:
        return None
    url = normalize_link_url(cleaned)
    if url is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Некорректная ссылка")
    preview = await fetch_link_preview(url)
    if preview is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Некорректная ссылка")
    return preview


@router.get("/link-preview", response_model=NewsLinkPreview)
async def link_preview(
    url: str = Query(..., min_length=4, max_length=512),
    _admin: TelegramUser = Depends(require_admin),
) -> NewsLinkPreview:
    normalized = normalize_link_url(url)
    if normalized is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Некорректная ссылка")
    preview = await fetch_link_preview(normalized)
    if preview is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Не удалось получить предпросмотр")
    return NewsLinkPreview(
        url=preview.url,
        title=preview.title,
        description=preview.description,
        image_url=preview.image_url,
    )


@router.get("", response_model=list[NewsRead])
def list_news(
    db: Session = Depends(db_session),
    _user: TelegramUser = Depends(get_current_user),
) -> list[NewsRead]:
    rows = list(db.scalars(select(NewsPost).order_by(NewsPost.created_at.desc()).limit(100)).all())
    return [news_to_read(db, row) for row in rows]


@router.post("", response_model=NewsRead, status_code=status.HTTP_201_CREATED)
async def create_news(
    title: str = Form(...),
    body: str = Form(...),
    link_url: str | None = Form(None),
    image: UploadFile | None = File(None),
    video: UploadFile | None = File(None),
    db: Session = Depends(db_session),
    admin: TelegramUser = Depends(require_admin),
) -> NewsRead:
    title_clean = title.strip()
    body_clean = body.strip()
    if len(title_clean) < 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Заголовок слишком короткий")
    if len(body_clean) < 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Текст слишком короткий")
    row = NewsPost(
        title=title_clean[:200],
        body=body_clean[:10000],
        author_telegram_id=admin.telegram_user_id,
    )
    db.add(row)
    db.flush()
    if image and image.filename:
        row.image_path = await save_news_image(row.id, image)
    if video and video.filename:
        row.video_path = await save_news_video(row.id, video)
    link = await _parse_link_url(link_url)
    if link is not None:
        _apply_link(row, link)
    db.commit()
    db.refresh(row)
    await notify_new_news(db, row)
    return news_to_read(db, row)


@router.put("/{post_id}", response_model=NewsRead)
async def update_news(
    post_id: int,
    title: str = Form(...),
    body: str = Form(...),
    link_url: str | None = Form(None),
    remove_link: bool = Form(False),
    image: UploadFile | None = File(None),
    video: UploadFile | None = File(None),
    remove_image: bool = Form(False),
    remove_video: bool = Form(False),
    db: Session = Depends(db_session),
    admin: TelegramUser = Depends(require_admin),
) -> NewsRead:
    row = db.get(NewsPost, post_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="News not found")
    title_clean = title.strip()
    body_clean = body.strip()
    if len(title_clean) < 2 or len(body_clean) < 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Заполните заголовок и текст")
    row.title = title_clean[:200]
    row.body = body_clean[:10000]
    if remove_image and row.image_path:
        delete_media_files(row.image_path)
        row.image_path = None
    if remove_video and row.video_path:
        delete_media_files(row.video_path)
        row.video_path = None
    if image and image.filename:
        if row.image_path:
            delete_media_files(row.image_path)
        row.image_path = await save_news_image(row.id, image)
    if video and video.filename:
        if row.video_path:
            delete_media_files(row.video_path)
        row.video_path = await save_news_video(row.id, video)
    if remove_link:
        _clear_link(row)
    elif link_url is not None:
        link = await _parse_link_url(link_url)
        if link is None:
            _clear_link(row)
        else:
            _apply_link(row, link)
    db.commit()
    db.refresh(row)
    return news_to_read(db, row)


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_news(
    post_id: int,
    db: Session = Depends(db_session),
    admin: TelegramUser = Depends(require_admin),
) -> None:
    row = db.get(NewsPost, post_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="News not found")
    delete_media_files(row.image_path, row.video_path)
    db.delete(row)
    db.commit()
