from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import db_session, get_current_user
from app.media_storage import delete_media_files, save_review_image
from app.models import Review, Subscriber
from app.review_access import require_review_write
from app.review_text import review_text_error
from app.schemas import ReviewRead, TelegramUser
from app.serializers import review_to_read

router = APIRouter(prefix="/reviews", tags=["reviews"])


def _subscriber(db: Session, user: TelegramUser) -> Subscriber:
    sub = db.get(Subscriber, user.telegram_user_id)
    if sub is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscriber not found")
    return sub


@router.get("", response_model=list[ReviewRead])
def list_reviews(
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(get_current_user),
) -> list[ReviewRead]:
    rows = list(db.scalars(select(Review).order_by(Review.created_at.desc()).limit(200)).all())
    return [review_to_read(db, row, user.telegram_user_id) for row in rows]


@router.post("", response_model=ReviewRead, status_code=status.HTTP_201_CREATED)
async def create_review(
    text: str = Form(...),
    rating: int = Form(5),
    image: UploadFile | None = File(None),
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(get_current_user),
) -> ReviewRead:
    sub = _subscriber(db, user)
    require_review_write(db, sub, is_admin=user.is_admin)
    existing = db.scalar(select(Review).where(Review.author_telegram_id == user.telegram_user_id))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="У вас уже есть отзыв — отредактируйте его",
        )
    if rating < 1 or rating > 5:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="rating must be 1–5")
    body = text.strip()
    if len(body) < 3:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Текст слишком короткий")
    if err := review_text_error(body):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err)
    row = Review(
        author_telegram_id=user.telegram_user_id,
        author_username=user.username,
        text=body[:2000],
        rating=rating,
    )
    db.add(row)
    db.flush()
    if image and image.filename:
        row.image_path = await save_review_image(row.id, image)
    db.commit()
    db.refresh(row)
    return review_to_read(db, row, user.telegram_user_id)


@router.put("/{review_id}", response_model=ReviewRead)
async def update_review(
    review_id: int,
    text: str = Form(...),
    rating: int = Form(...),
    image: UploadFile | None = File(None),
    remove_image: bool = Form(False),
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(get_current_user),
) -> ReviewRead:
    sub = _subscriber(db, user)
    require_review_write(db, sub, is_admin=user.is_admin)
    row = db.get(Review, review_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
    if row.author_telegram_id != user.telegram_user_id and not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    if rating < 1 or rating > 5:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="rating must be 1–5")
    body = text.strip()
    if len(body) < 3:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Текст слишком короткий")
    if err := review_text_error(body):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err)
    row.text = body[:2000]
    row.rating = rating
    if user.username:
        row.author_username = user.username
    if remove_image and row.image_path:
        delete_media_files(row.image_path)
        row.image_path = None
    if image and image.filename:
        if row.image_path:
            delete_media_files(row.image_path)
        row.image_path = await save_review_image(row.id, image)
    db.commit()
    db.refresh(row)
    return review_to_read(db, row, user.telegram_user_id)


@router.delete("/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_review(
    review_id: int,
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(get_current_user),
) -> None:
    row = db.get(Review, review_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
    if row.author_telegram_id != user.telegram_user_id and not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    delete_media_files(row.image_path)
    db.delete(row)
    db.commit()
