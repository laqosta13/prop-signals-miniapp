from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import db_session, get_current_user, require_admin
from app.media_storage import delete_media_files, save_news_image
from app.models import NewsPost
from app.schemas import NewsRead, TelegramUser
from app.serializers import news_to_read

router = APIRouter(prefix="/news", tags=["news"])


@router.get("", response_model=list[NewsRead])
def list_news(
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(get_current_user),
) -> list[NewsRead]:
    rows = list(db.scalars(select(NewsPost).order_by(NewsPost.created_at.desc()).limit(100)).all())
    return [news_to_read(db, row) for row in rows]


@router.post("", response_model=NewsRead, status_code=status.HTTP_201_CREATED)
async def create_news(
    title: str = Form(...),
    body: str = Form(...),
    image: UploadFile | None = File(None),
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
    db.commit()
    db.refresh(row)
    return news_to_read(db, row)


@router.put("/{post_id}", response_model=NewsRead)
async def update_news(
    post_id: int,
    title: str = Form(...),
    body: str = Form(...),
    image: UploadFile | None = File(None),
    remove_image: bool = Form(False),
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
    if image and image.filename:
        if row.image_path:
            delete_media_files(row.image_path)
        row.image_path = await save_news_image(row.id, image)
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
    delete_media_files(row.image_path)
    db.delete(row)
    db.commit()
