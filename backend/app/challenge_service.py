from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.hashhedge_rules import rules_for_stage
from app.media_storage import public_url
from app.serializers import trader_display_name, trader_login
from app.models import Signal, Trader, UserChallenge
from app.trader_stats import pnl_usd_for_outcome, signal_tracker_balance


def admin_ids() -> list[int]:
    return sorted(settings.admin_id_set)


def get_or_create_challenge(db: Session, admin_id: int) -> UserChallenge:
    if admin_id not in settings.admin_id_set:
        raise ValueError("not an admin")
    row = db.get(UserChallenge, admin_id)
    if row is None:
        row = UserChallenge(
            telegram_user_id=admin_id,
            account_size=10_000.0,
            stage=1,
            balance=10_000.0,
            day_start_balance=10_000.0,
            trading_days=0,
        )
        db.add(row)
        db.flush()
    return row


def admin_tracker_balance(db: Session, admin_id: int) -> float:
    """Текущий баланс трекера админа на момент публикации сигнала."""
    return get_or_create_challenge(db, admin_id).balance


def ensure_tracker_for_new_signal(db: Session, signal: Signal) -> None:
    if signal.author_telegram_id not in settings.admin_id_set:
        return
    ch = get_or_create_challenge(db, signal.author_telegram_id)
    tb = signal_tracker_balance(signal)
    prior = db.scalar(
        select(func.count())
        .select_from(Signal)
        .where(Signal.author_telegram_id == signal.author_telegram_id, Signal.id != signal.id)
    )
    if prior == 0 and tb > 0:
        ch.account_size = ch.balance = ch.day_start_balance = tb


def apply_signal_to_tracker(db: Session, signal: Signal) -> None:
    if signal.author_telegram_id not in settings.admin_id_set or signal.realized_pnl is None:
        return
    ch = get_or_create_challenge(db, signal.author_telegram_id)
    ch.balance = round(ch.balance + signal.realized_pnl, 2)


def build_dashboard(db: Session, ch: UserChallenge, trader: Trader | None = None) -> dict:
    from app.schemas import ChallengeDashboard

    owner_id = ch.telegram_user_id
    rules = rules_for_stage(ch.stage)
    start, balance = ch.account_size, ch.balance
    profit_pct = ((balance - start) / start * 100.0) if start > 0 else 0.0
    drawdown_pct = max(0.0, (start - balance) / start * 100.0) if start > 0 and balance < start else 0.0
    daily_loss_usd = max(0.0, ch.day_start_balance - balance)
    daily_loss_pct = (daily_loss_usd / ch.day_start_balance * 100.0) if ch.day_start_balance > 0 else 0.0
    max_daily_usd = ch.day_start_balance * rules.max_daily_loss_pct / 100.0

    closed = db.scalars(
        select(Signal.status)
        .where(Signal.author_telegram_id == owner_id, Signal.status.in_(("win", "lose")))
    ).all()
    wins = sum(1 for s in closed if s == "win")
    total = len(closed)

    if trader is None:
        trader = db.get(Trader, owner_id)
    login = trader_login(trader, db.scalar(
        select(Signal.author_username)
        .where(Signal.author_telegram_id == owner_id, Signal.author_username.isnot(None))
        .order_by(Signal.created_at.desc())
        .limit(1)
    ))

    return ChallengeDashboard(
        owner_telegram_id=owner_id,
        owner_username=login,
        owner_display_name=trader_display_name(trader, login),
        owner_avatar_url=public_url(trader.avatar_path) if trader and trader.avatar_path else None,
        account_size=start,
        stage=ch.stage,
        balance=balance,
        profit_pct=round(profit_pct, 2),
        profit_target_pct=rules.profit_target_pct,
        drawdown_pct=round(drawdown_pct, 2),
        max_drawdown_pct=rules.max_drawdown_pct,
        daily_loss_pct=round(daily_loss_pct, 2),
        max_daily_loss_pct=rules.max_daily_loss_pct,
        daily_remaining_usd=round(max(0.0, max_daily_usd - daily_loss_usd), 2),
        trading_days=ch.trading_days,
        min_trading_days=rules.min_trading_days,
        goal_balance=round(start * (1 + rules.profit_target_pct / 100.0), 2),
        trades_count=total,
        winrate=round(wins / total * 100, 1) if total else 0.0,
        total_pnl=round(balance - start, 2),
        max_leverage=rules.max_leverage,
    )


def list_admin_trackers(db: Session) -> list:
    ids = admin_ids()
    if not ids:
        return []
    traders = {t.telegram_id: t for t in db.scalars(select(Trader).where(Trader.telegram_id.in_(ids)))}
    from app.signal_service import get_or_create_trader

    out = []
    for aid in ids:
        tr = traders.get(aid)
        tr = get_or_create_trader(db, aid, tr.username if tr else None, first_name=tr.first_name if tr else None, last_name=tr.last_name if tr else None)
        out.append(build_dashboard(db, get_or_create_challenge(db, aid), tr))
    out.sort(key=lambda d: d.balance - d.account_size, reverse=True)
    return out
