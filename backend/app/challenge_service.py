from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.hashhedge_rules import rules_for_stage
from app.media_storage import public_url
from app.serializers import trader_display_name, trader_login
from app.models import Signal, Trader, UserChallenge
from app.tracker_metrics import compute_tracker_stats, msk_day_key
from app.trader_stats import signal_tracker_balance


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


def admin_account_size(db: Session, admin_id: int) -> float:
    """Размер счёта Hash Hedge — база для номинала позиции и P/L."""
    return get_or_create_challenge(db, admin_id).account_size


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


def _closed_signals(db: Session, owner_id: int) -> list[Signal]:
    return list(
        db.scalars(
            select(Signal)
            .where(Signal.author_telegram_id == owner_id, Signal.status.in_(("win", "lose")))
            .order_by(Signal.closed_at.asc())
        ).all()
    )


def _sync_trading_days(db: Session, ch: UserChallenge) -> None:
    closed = _closed_signals(db, ch.telegram_user_id)
    ch.trading_days = len({msk_day_key(s.closed_at) for s in closed if msk_day_key(s.closed_at)})


def apply_prop_balance_sync(db: Session, ch: UserChallenge, new_balance: float) -> None:
    """Сверка с пропом: balance = проп; account_size и метрики — из истории сделок."""
    from app.trader_stats import closed_signal_pnl_usd

    closed = _closed_signals(db, ch.telegram_user_id)
    total_pnl = round(sum(closed_signal_pnl_usd(s) for s in closed), 2)
    bal = round(new_balance, 2)
    ch.balance = bal
    ch.account_size = round(max(bal - total_pnl, 0.01), 2)
    rules = rules_for_stage(ch.stage)
    stats = compute_tracker_stats(
        ch,
        closed,
        max_daily_loss_pct=rules.max_daily_loss_pct,
    )
    ch.day_start_balance = stats.day_start_balance
    ch.trading_days = stats.trading_days
    _sync_trading_days(db, ch)
    db.flush()


def rebuild_tracker_balances_from_signals(db: Session, admin_ids: list[int]) -> None:
    """Баланс трекера = стартовый депозит + сумма realized_pnl закрытых сигналов."""
    from app.trader_stats import closed_signal_pnl_usd

    for aid in admin_ids:
        ch = get_or_create_challenge(db, aid)
        closed = _closed_signals(db, aid)
        total_pnl = round(sum(closed_signal_pnl_usd(s) for s in closed), 2)
        ch.balance = round(ch.account_size + total_pnl, 2)
        _sync_trading_days(db, ch)


def apply_signal_to_tracker(db: Session, signal: Signal) -> None:
    if signal.author_telegram_id not in settings.admin_id_set or signal.realized_pnl is None:
        return
    ch = get_or_create_challenge(db, signal.author_telegram_id)
    ch.balance = round(ch.balance + signal.realized_pnl, 2)
    _sync_trading_days(db, ch)


def build_dashboard(db: Session, ch: UserChallenge, trader: Trader | None = None) -> dict:
    from app.schemas import ChallengeDashboard

    owner_id = ch.telegram_user_id
    rules = rules_for_stage(ch.stage)
    start, balance = ch.account_size, ch.balance
    profit_pct = ((balance - start) / start * 100.0) if start > 0 else 0.0

    closed = _closed_signals(db, owner_id)
    stats = compute_tracker_stats(
        ch,
        closed,
        max_daily_loss_pct=rules.max_daily_loss_pct,
    )
    ch.trading_days = stats.trading_days

    if trader is None:
        trader = db.get(Trader, owner_id)
    login = trader_login(trader, db.scalar(
        select(Signal.author_username)
        .where(Signal.author_telegram_id == owner_id, Signal.author_username.isnot(None))
        .order_by(Signal.created_at.desc())
        .limit(1)
    ))

    profit_unlimited = rules.profit_target_pct is None
    min_days_unlimited = rules.min_trading_days is None
    target_pct = rules.profit_target_pct or 0.0
    goal = balance if profit_unlimited else round(start * (1 + target_pct / 100.0), 2)

    return ChallengeDashboard(
        owner_telegram_id=owner_id,
        owner_username=login,
        owner_display_name=trader_display_name(trader, login),
        owner_avatar_url=public_url(trader.avatar_path) if trader and trader.avatar_path else None,
        account_size=start,
        stage=ch.stage,
        balance=balance,
        profit_pct=round(profit_pct, 2),
        profit_target_pct=target_pct,
        profit_target_unlimited=profit_unlimited,
        drawdown_pct=stats.drawdown_pct,
        max_drawdown_pct=rules.max_drawdown_pct,
        daily_loss_pct=stats.daily_loss_pct,
        max_daily_loss_pct=rules.max_daily_loss_pct,
        daily_remaining_usd=stats.daily_remaining_usd,
        trading_days=stats.trading_days,
        min_trading_days=rules.min_trading_days or 0,
        min_trading_days_unlimited=min_days_unlimited,
        goal_balance=goal,
        trades_count=stats.trades_count,
        winrate=stats.winrate,
        total_pnl=round(balance - start, 2),
        max_leverage=rules.max_leverage,
        prop_screenshot_url=public_url(ch.prop_screenshot_path),
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
