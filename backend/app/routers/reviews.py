from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import db_session, get_current_user, require_admin
from app.models import Review
from app.schemas import ReviewCreate, ReviewRead, ReviewUpdate, TelegramUser
from app.serializers import review_to_read

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.get("", response_model=list[ReviewRead])
def list_reviews(
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(get_current_user),
) -> list[ReviewRead]:
    rows = list(db.scalars(select(Review).order_by(Review.created_at.desc()).limit(200)).all())
    return [review_to_read(db, row, user.telegram_user_id) for row in rows]


@router.post("", response_model=ReviewRead, status_code=status.HTTP_201_CREATED)
def create_review(
    body: ReviewCreate,
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(get_current_user),
) -> ReviewRead:
    existing = db.scalar(select(Review).where(Review.author_telegram_id == user.telegram_user_id))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="У вас уже есть отзыв — отредактируйте его",
        )
    row = Review(
        author_telegram_id=user.telegram_user_id,
        author_username=user.username,
        text=body.text.strip(),
        rating=body.rating,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return review_to_read(db, row, user.telegram_user_id)


@router.put("/{review_id}", response_model=ReviewRead)
def update_review(
    review_id: int,
    body: ReviewUpdate,
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(get_current_user),
) -> ReviewRead:
    row = db.get(Review, review_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
    if row.author_telegram_id != user.telegram_user_id and not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    row.text = body.text.strip()
    row.rating = body.rating
    if user.username:
        row.author_username = user.username
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
    db.delete(row)
    db.commit()
