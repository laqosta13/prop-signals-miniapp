from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Signal, SignalLike, SignalView


def record_view(db: Session, signal_id: int, telegram_user_id: int) -> int:
    signal = db.get(Signal, signal_id)
    if signal is None:
        return 0
    existing = db.get(SignalView, (signal_id, telegram_user_id))
    if existing:
        return signal.views_count or 0
    try:
        with db.begin_nested():
            db.add(SignalView(signal_id=signal_id, telegram_user_id=telegram_user_id))
            db.flush()
    except IntegrityError:
        return signal.views_count or 0
    signal.views_count = (signal.views_count or 0) + 1
    db.flush()
    return signal.views_count or 0


def toggle_like(db: Session, signal_id: int, telegram_user_id: int) -> tuple[bool, int] | None:
    signal = db.get(Signal, signal_id)
    if signal is None:
        return None
    row = db.get(SignalLike, (signal_id, telegram_user_id))
    if row:
        db.delete(row)
        signal.likes_count = max(0, (signal.likes_count or 0) - 1)
        liked = False
    else:
        db.add(SignalLike(signal_id=signal_id, telegram_user_id=telegram_user_id))
        try:
            with db.begin_nested():
                db.flush()
        except IntegrityError:
            pass
        signal.likes_count = (signal.likes_count or 0) + 1
        liked = True
    db.flush()
    return liked, signal.likes_count or 0


def user_liked(db: Session, signal_id: int, telegram_user_id: int) -> bool:
    return db.get(SignalLike, (signal_id, telegram_user_id)) is not None
