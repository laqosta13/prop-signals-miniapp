"""Проверка прав на изменение сигнала."""

from fastapi import HTTPException, status

from app.models import Signal
from app.schemas import TelegramUser


def require_signal_owner(row: Signal, admin: TelegramUser) -> None:
    if row.author_telegram_id != admin.telegram_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Можно изменять только свои сигналы",
        )


def require_signal_owner_or_super_admin(row: Signal, admin: TelegramUser) -> None:
    if admin.is_super_admin:
        return
    require_signal_owner(row, admin)


def require_signal_engagement(row: Signal, user: TelegramUser) -> None:
    """Просмотры и лайки: без подписки только на отработанных сигналах."""
    if user.is_admin or user.subscription_active:
        return
    if row.status in ("win", "lose"):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="subscription_required",
    )
