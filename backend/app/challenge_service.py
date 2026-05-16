from sqlalchemy import select
from sqlalchemy.orm import Session

from app.hashhedge_rules import rules_for_stage
from app.models import Signal, UserChallenge
from app.schemas import ChallengeDashboard


def get_or_create_challenge(db: Session, telegram_id: int) -> UserChallenge:
    row = db.get(UserChallenge, telegram_id)
    if row is None:
        row = UserChallenge(
            telegram_user_id=telegram_id,
            account_size=10_000.0,
            stage=1,
            balance=10_000.0,
            day_start_balance=10_000.0,
            trading_days=0,
        )
        db.add(row)
        db.flush()
    return row


def build_dashboard(db: Session, ch: UserChallenge) -> ChallengeDashboard:
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
        db.scalars(select(Signal).where(Signal.status.in_(("win", "lose"))).order_by(Signal.closed_at.desc()).limit(500)).all()
    )
    wins = sum(1 for s in closed if s.status == "win")
    total = len(closed)
    winrate = round(wins / total * 100, 1) if total else 0.0
    total_pnl = sum(s.realized_pnl or 0 for s in closed)

    return ChallengeDashboard(
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
        total_pnl=round(total_pnl, 2),
        max_leverage=rules.max_leverage,
    )
