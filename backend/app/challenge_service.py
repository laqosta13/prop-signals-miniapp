from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.hashhedge_rules import rules_for_stage
from app.media_storage import public_url
from app.models import Signal, Trader, UserChallenge
from app.schemas import ChallengeDashboard
from app.trader_stats import pnl_usd_for_outcome, signal_tracker_balance


def admin_tracker_ids(db: Session) -> list[int]:
    ids = set(settings.admin_id_set)
    for row in db.scalars(select(UserChallenge.telegram_user_id)):
        ids.add(row)
    if settings.admin_id_set:
        for row in db.scalars(
            select(Signal.author_telegram_id)
            .where(Signal.author_telegram_id.in_(settings.admin_id_set))
            .distinct()
        ):
            ids.add(row)
    elif not ids:
        for row in db.scalars(select(Signal.author_telegram_id).distinct()):
            ids.add(row)
    return sorted(ids)


def get_or_create_challenge(db: Session, admin_telegram_id: int) -> UserChallenge:
    row = db.get(UserChallenge, admin_telegram_id)
    if row is None:
        row = UserChallenge(
            telegram_user_id=admin_telegram_id,
            account_size=10_000.0,
            stage=1,
            balance=10_000.0,
            day_start_balance=10_000.0,
            trading_days=0,
        )
        db.add(row)
        db.flush()
    return row


def _owner_username(db: Session, telegram_id: int) -> str | None:
    trader = db.get(Trader, telegram_id)
    if trader and trader.username:
        return trader.username
    sig = db.scalar(
        select(Signal.author_username)
        .where(Signal.author_telegram_id == telegram_id, Signal.author_username.isnot(None))
        .order_by(Signal.created_at.desc())
        .limit(1)
    )
    return sig


def ensure_tracker_for_new_signal(db: Session, signal: Signal) -> None:
    """Привязка трекера к админу; стартовый баланс из поля «трекер» первого сигнала."""
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
        ch.account_size = tb
        ch.balance = tb
        ch.day_start_balance = tb


def apply_signal_to_tracker(db: Session, signal: Signal) -> None:
    """После WIN/LOSE: баланс ±P/L, лимит дня и просадка пересчитываются в dashboard."""
    if signal.author_telegram_id not in settings.admin_id_set:
        return
    if signal.realized_pnl is None:
        return
    ch = get_or_create_challenge(db, signal.author_telegram_id)
    ch.balance = round(ch.balance + signal.realized_pnl, 2)


def build_dashboard(db: Session, ch: UserChallenge) -> ChallengeDashboard:
    owner_id = ch.telegram_user_id
    rules = rules_for_stage(ch.stage)
    start = ch.account_size
    balance = ch.balance
    profit_pct = ((balance - start) / start * 100.0) if start > 0 else 0.0
    drawdown_pct = max(0.0, (start - balance) / start * 100.0) if start > 0 and balance < start else 0.0
    daily_loss_usd = max(0.0, ch.day_start_balance - balance)
    daily_loss_pct = (daily_loss_usd / ch.day_start_balance * 100.0) if ch.day_start_balance > 0 else 0.0
    max_daily_usd = ch.day_start_balance * rules.max_daily_loss_pct / 100.0
    daily_remaining = max(0.0, max_daily_usd - daily_loss_usd)
    goal = start * (1 + rules.profit_target_pct / 100.0)

    closed = list(
        db.scalars(
            select(Signal)
            .where(
                Signal.author_telegram_id == owner_id,
                Signal.status.in_(("win", "lose")),
            )
            .order_by(Signal.closed_at.desc())
            .limit(500)
        ).all()
    )
    wins = sum(1 for s in closed if s.status == "win")
    total = len(closed)
    winrate = round(wins / total * 100, 1) if total else 0.0
    total_pnl = round(balance - start, 2)

    trader = db.get(Trader, owner_id)
    avatar_url = public_url(trader.avatar_path) if trader and trader.avatar_path else None

    return ChallengeDashboard(
        owner_telegram_id=owner_id,
        owner_username=_owner_username(db, owner_id),
        owner_avatar_url=avatar_url,
        account_size=start,
        stage=ch.stage,
        balance=balance,
        profit_pct=round(profit_pct, 2),
        profit_target_pct=rules.profit_target_pct,
        drawdown_pct=round(drawdown_pct, 2),
        max_drawdown_pct=rules.max_drawdown_pct,
        daily_loss_pct=round(daily_loss_pct, 2),
        max_daily_loss_pct=rules.max_daily_loss_pct,
        daily_remaining_usd=round(daily_remaining, 2),
        trading_days=ch.trading_days,
        min_trading_days=rules.min_trading_days,
        goal_balance=round(goal, 2),
        trades_count=total,
        winrate=winrate,
        total_pnl=total_pnl,
        max_leverage=rules.max_leverage,
    )


def list_admin_trackers(db: Session) -> list[ChallengeDashboard]:
    result: list[ChallengeDashboard] = []
    for admin_id in admin_tracker_ids(db):
        ch = get_or_create_challenge(db, admin_id)
        result.append(build_dashboard(db, ch))
    result.sort(key=lambda d: d.balance - d.account_size, reverse=True)
    return result


def replay_trackers_from_closed_signals(db: Session) -> None:
    """Пересчёт балансов трекеров по истории закрытых сигналов админов."""
    for admin_id in admin_tracker_ids(db):
        ch = get_or_create_challenge(db, admin_id)
        start = ch.account_size
        ch.balance = start
        ch.day_start_balance = start

        closed = list(
            db.scalars(
                select(Signal)
                .where(
                    Signal.author_telegram_id == admin_id,
                    Signal.status.in_(("win", "lose")),
                )
                .order_by(Signal.closed_at.asc(), Signal.id.asc())
            ).all()
        )
        if closed:
            first_tb = signal_tracker_balance(closed[0])
            if first_tb > 0 and ch.account_size == 10_000.0:
                ch.account_size = first_tb
                ch.balance = first_tb
                ch.day_start_balance = first_tb
                start = first_tb

        balance = start
        for sig in closed:
            if sig.realized_pnl is None:
                sig.realized_pnl = pnl_usd_for_outcome(sig, sig.status)
            balance = round(balance + (sig.realized_pnl or 0), 2)
        ch.balance = balance
