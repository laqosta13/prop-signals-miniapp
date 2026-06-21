"""Пользователи-кандидаты CULT: регистрация, сигналы, статистика %."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.active_signal_read import build_active_signal_read
from app.copy_trading_service import copy_deposit_base_usd
from app.models import CultCandidate, CultChannel, Signal, UserBybitSettings
from app.schemas import (
    CultCandidateActiveSignalRead,
    CultCandidateClosedSignalRead,
    CultCandidateFormSnapshot,
    CultCandidateMeRead,
    CultCandidateRead,
    TelegramUser,
    TraderDayStat,
)
from app.serializers import trader_avatar_url, trader_login, trader_rank_read
from app.signal_service import get_or_create_trader
from app.signal_utils import (
    effective_entry_price,
    outcome_from_move,
    price_move_pct,
    trade_move_pct,
)
from app.cult_subscription_billing import cult_subscription_active
from app.models import Subscriber


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_display_name(raw: str) -> str:
    name = " ".join(raw.strip().split())
    if len(name) < 2:
        raise ValueError("Имя в карточке — минимум 2 символа")
    if len(name) > 64:
        raise ValueError("Имя в карточке — не длиннее 64 символов")
    return name


def display_name_from_telegram(
    *,
    first_name: str | None,
    last_name: str | None,
    username: str | None,
) -> str:
    parts = [first_name, last_name]
    name = " ".join(p.strip() for p in parts if p and str(p).strip())
    if len(name) >= 2:
        return _normalize_display_name(name)
    login = (username or "").strip().lstrip("@")
    if len(login) >= 2:
        return _normalize_display_name(login)
    raise ValueError("Укажите имя и фамилию в профиле Telegram или username от 2 символов")


def is_cult_candidate(db: Session, telegram_id: int) -> bool:
    row = db.get(CultCandidate, telegram_id)
    return row is not None and bool(row.enabled)


def _trade_access_blockers(db: Session, sub: Subscriber, *, cult_admin_bypass: bool = False) -> list[str]:
    """Проверки для публикации сигнала: подписка + API/канал (без раннего выхода для уже-кандидатов)."""
    if not cult_subscription_active(sub, is_admin=cult_admin_bypass):
        return ["Нужна подписка кандидата CULT ($20 / 30 дней)"]
    if cult_admin_bypass:
        return []
    has_bybit = db.get(UserBybitSettings, sub.telegram_user_id) is not None
    has_channel = db.scalar(
        select(CultChannel).where(
            CultChannel.added_by_telegram_id == sub.telegram_user_id,
            CultChannel.enabled.is_(True),
        )
    ) is not None
    if not has_bybit and not has_channel:
        return ["Доступ через API Bybit или CULT-канал"]
    return []


def join_blockers(db: Session, sub: Subscriber, *, cult_admin_bypass: bool = False) -> list[str]:
    from app.trader_roster_service import is_main_feed_publisher

    if is_main_feed_publisher(db, sub.telegram_user_id):
        return ["Админы в ТОП публикуют в основную ленту"]
    if is_cult_candidate(db, sub.telegram_user_id):
        return []
    return _trade_access_blockers(db, sub, cult_admin_bypass=cult_admin_bypass)


def join_cult_candidate(
    db: Session,
    sub: Subscriber,
    *,
    cult_admin_bypass: bool,
    user: TelegramUser,
    display_name: str | None = None,
) -> CultCandidate:
    from app.signal_service import get_or_create_trader

    blockers = join_blockers(db, sub, cult_admin_bypass=cult_admin_bypass)
    if blockers:
        raise ValueError(blockers[0])
    if display_name and display_name.strip():
        name = _normalize_display_name(display_name)
    else:
        name = display_name_from_telegram(
            first_name=user.first_name,
            last_name=user.last_name,
            username=user.username,
        )
    get_or_create_trader(
        db,
        sub.telegram_user_id,
        user.username,
        first_name=user.first_name,
        last_name=user.last_name,
    )
    existing = db.get(CultCandidate, sub.telegram_user_id)
    if existing:
        existing.display_name = name
        existing.enabled = True
        return existing
    row = CultCandidate(
        telegram_user_id=sub.telegram_user_id,
        display_name=name,
        joined_at=_now(),
    )
    db.add(row)
    db.flush()
    return row


def update_display_name(db: Session, telegram_id: int, display_name: str) -> CultCandidate:
    row = db.get(CultCandidate, telegram_id)
    if row is None or not row.enabled:
        raise ValueError("Вы не кандидат")
    row.display_name = _normalize_display_name(display_name)
    return row


def _closed_move_pct(sig: Signal) -> float:
    entry = effective_entry_price(sig.entry_low, sig.entry_high, sig.published_market_price)
    if entry is None or sig.closed_exit_price is None:
        return 0.0
    return price_move_pct(entry, sig.direction, float(sig.closed_exit_price))


def apply_outcome_to_cult_candidate(
    db: Session,
    candidate: CultCandidate,
    signal: Signal,
    outcome: str,
    exit_price: float,
    *,
    close_reason: str | None = None,
) -> bool:
    if signal.status != "active":
        return False
    move = trade_move_pct(
        signal.entry_low,
        signal.entry_high,
        signal.direction,
        outcome,
        exit_price=exit_price,
        stop_loss=signal.stop_loss,
        take_profits=signal.take_profits,
        published_market_price=signal.published_market_price,
    )
    final_outcome = outcome_from_move(move)
    if close_reason:
        signal.close_reason = close_reason
    elif final_outcome == "win":
        signal.close_reason = "target"
    else:
        signal.close_reason = "stop"
    signal.status = final_outcome
    signal.closed_at = _now()
    signal.closed_exit_price = exit_price

    wins = int(candidate.wins or 0)
    losses = int(candidate.losses or 0)
    if move >= 0:
        candidate.wins = wins + 1
    else:
        candidate.losses = losses + 1
    candidate.rating_percent = round(float(candidate.rating_percent or 0) + move, 2)
    return True


def _active_signals_for(db: Session, user_ids: list[int]) -> dict[int, list[CultCandidateActiveSignalRead]]:
    if not user_ids:
        return {}
    rows = list(
        db.scalars(
            select(Signal)
            .where(
                Signal.is_cult_candidate.is_(True),
                Signal.author_telegram_id.in_(user_ids),
                Signal.status == "active",
            )
            .order_by(Signal.created_at.desc())
        ).all()
    )
    out: dict[int, list[CultCandidateActiveSignalRead]] = defaultdict(list)
    for s in rows:
        out[s.author_telegram_id].append(build_active_signal_read(s))
    return out


def _closed_signals_for(db: Session, user_ids: list[int], *, limit: int = 30) -> dict[int, list[CultCandidateClosedSignalRead]]:
    if not user_ids:
        return {}
    rows = list(
        db.scalars(
            select(Signal)
            .where(
                Signal.is_cult_candidate.is_(True),
                Signal.author_telegram_id.in_(user_ids),
                Signal.status.in_(("win", "lose")),
            )
            .order_by(Signal.closed_at.desc(), Signal.id.desc())
        ).all()
    )
    out: dict[int, list[CultCandidateClosedSignalRead]] = defaultdict(list)
    for s in rows:
        uid = s.author_telegram_id
        if len(out[uid]) >= limit:
            continue
        stake = s.risk_percent if s.risk_percent is not None else 10.0
        exit_px = float(s.closed_exit_price) if s.closed_exit_price is not None else None
        out[uid].append(
            CultCandidateClosedSignalRead(
                id=s.id,
                symbol=s.symbol,
                direction=s.direction,
                status=s.status,
                move_pct=_closed_move_pct(s),
                exit_price=exit_px,
                stake_percent=float(stake),
                closed_at=s.closed_at or s.created_at,
            )
        )
    return out


def get_cult_candidate_signal(db: Session, signal_id: int) -> Signal:
    row = db.get(Signal, signal_id)
    if row is None or not row.is_cult_candidate or row.status not in ("win", "lose"):
        raise ValueError("Сделка не найдена")
    return row


def _daily_stats(db: Session, user_ids: list[int]) -> dict[int, list[TraderDayStat]]:
    if not user_ids:
        return {}
    rows = list(
        db.scalars(
            select(Signal).where(
                Signal.is_cult_candidate.is_(True),
                Signal.author_telegram_id.in_(user_ids),
                Signal.status.in_(("win", "lose")),
            )
        ).all()
    )
    buckets: dict[int, dict[str, dict]] = defaultdict(lambda: defaultdict(lambda: {"rating": 0.0, "w": 0, "l": 0}))
    for s in rows:
        move = _closed_move_pct(s)
        day = s.closed_at.astimezone(timezone.utc).date().isoformat() if s.closed_at else s.created_at.date().isoformat()
        b = buckets[s.author_telegram_id][day]
        b["rating"] = round(b["rating"] + move, 2)
        if move >= 0:
            b["w"] += 1
        else:
            b["l"] += 1
    out: dict[int, list[TraderDayStat]] = {}
    for uid, days in buckets.items():
        out[uid] = [
            TraderDayStat(date=d, pnl_usd=0.0, rating_delta=v["rating"], wins=v["w"], losses=v["l"])
            for d, v in sorted(days.items(), reverse=True)
        ][:90]
    return out


def _candidate_read(
    db: Session,
    row: CultCandidate,
    *,
    rank: int,
    daily: dict[int, list[TraderDayStat]],
    active: dict[int, list[CultCandidateActiveSignalRead]],
    closed: dict[int, list[CultCandidateClosedSignalRead]],
    is_me: bool = False,
    pool_share_usd: float = 0.0,
) -> CultCandidateRead:
    from app.models import Trader

    trader = db.get(Trader, row.telegram_user_id)
    total = (row.wins or 0) + (row.losses or 0)
    wr = round((row.wins or 0) / total * 100, 1) if total else 0.0
    from app.trading_style import build_volnovoi_style

    return CultCandidateRead(
        telegram_user_id=row.telegram_user_id,
        display_name=row.display_name,
        username=trader_login(trader, trader.username if trader else None),
        avatar_url=trader_avatar_url(trader),
        rating_percent=float(row.rating_percent or 0),
        wins=row.wins or 0,
        losses=row.losses or 0,
        rank=rank,
        win_rate=wr,
        joined_at=row.joined_at,
        daily_stats=daily.get(row.telegram_user_id, []),
        active_signals=active.get(row.telegram_user_id, []),
        closed_signals=closed.get(row.telegram_user_id, []),
        trader_rank=trader_rank_read(trader, include_history=False) if trader else None,
        volnovoi_style=build_volnovoi_style(db, row.telegram_user_id, cult_candidate=True),
        is_me=is_me,
        pool_share_usd=pool_share_usd,
        outside_trade=bool(row.outside_trade),
    )


def build_cult_candidates_read(
    db: Session,
    *,
    viewer_id: int | None = None,
    viewer_can_see_active: bool = False,
) -> list[CultCandidateRead]:
    from app.trader_roster_service import ROSTER_FIRED, ROSTER_TOP, demoted_admin_ids, roster_overrides_map

    overrides = roster_overrides_map(db)
    demoted = set(demoted_admin_ids(db))
    all_rows = list(db.scalars(select(CultCandidate).where(CultCandidate.enabled.is_(True))).all())

    # Все участники пула (cult candidates + demoted admins, без TOP/FIRED) — для сквозного ранжирования
    eligible = [
        r for r in all_rows
        if overrides.get(r.telegram_user_id) not in (ROSTER_TOP, ROSTER_FIRED)
    ]
    all_ranked = sorted(eligible, key=lambda c: (-(c.rating_percent or 0), -(c.wins or 0)))
    true_ranks: dict[int, int] = {r.telegram_user_id: rank for rank, r in enumerate(all_ranked, start=1)}

    # Все участники видны всем — demoted admins отображаются как CultCandidateCard с сигналами
    visible = list(eligible)
    if not visible:
        return []

    ids = [r.telegram_user_id for r in visible]
    daily = _daily_stats(db, ids)
    active_all = _active_signals_for(db, ids)
    closed = _closed_signals_for(db, ids)
    visible_sorted = sorted(visible, key=lambda r: true_ranks.get(r.telegram_user_id, 9999))
    from app.pool_service import combined_candidate_pool_shares
    candidate_shares = combined_candidate_pool_shares(db)
    result = []
    for row in visible_sorted:
        is_me = viewer_id is not None and row.telegram_user_id == viewer_id
        active = active_all if (viewer_can_see_active or is_me) else {}
        result.append(
            _candidate_read(
                db,
                row,
                rank=true_ranks[row.telegram_user_id],
                daily=daily,
                active=active,
                closed=closed,
                is_me=is_me,
                pool_share_usd=candidate_shares.get(row.telegram_user_id, 0.0),
            )
        )
    return result


def build_cult_candidate_me_read(db: Session, sub: Subscriber) -> CultCandidateMeRead:
    from app.trader_roster_service import cult_subscription_admin_bypass, is_main_feed_publisher

    row = db.get(CultCandidate, sub.telegram_user_id)
    bypass = cult_subscription_admin_bypass(db, sub.telegram_user_id)
    blockers = join_blockers(db, sub, cult_admin_bypass=bypass)
    bybit = db.get(UserBybitSettings, sub.telegram_user_id)
    from app.test_mode import test_mode_public_fields

    test_mode = test_mode_public_fields()
    return CultCandidateMeRead(
        is_candidate=row is not None and bool(row.enabled),
        display_name=row.display_name if row else None,
        can_join=len(blockers) == 0,
        blockers=blockers,
        main_feed_publisher=is_main_feed_publisher(db, sub.telegram_user_id),
        bybit_configured=bybit is not None,
        cult_subscription_active=cult_subscription_active(sub, is_admin=bypass),
        cult_subscription_until=sub.cult_subscription_until,
        test_mode_active=test_mode["test_mode_active"],
        test_mode_until=test_mode["test_mode_until"],
        test_mode_days_left=int(test_mode["test_mode_days_left"]),
    )


def cult_candidate_account_size(db: Session, telegram_id: int) -> float:
    bybit = db.get(UserBybitSettings, telegram_id)
    if bybit is None:
        return 1_000.0
    return copy_deposit_base_usd(bybit)


def _candidate_active_signals(db: Session, author_id: int) -> list[Signal]:
    return list(
        db.scalars(
            select(Signal).where(
                Signal.author_telegram_id == author_id,
                Signal.status == "active",
                Signal.is_cult_candidate.is_(True),
            )
        ).all()
    )


def candidate_active_stake_used(db: Session, author_id: int, *, exclude_signal_id: int | None = None) -> float:
    from app.signal_stake_pool import _signal_stake_expr

    q = select(func.coalesce(func.sum(_signal_stake_expr()), 0.0)).where(
        Signal.status == "active",
        Signal.is_cult_candidate.is_(True),
        Signal.author_telegram_id == author_id,
    )
    if exclude_signal_id is not None:
        q = q.where(Signal.id != exclude_signal_id)
    return round(float(db.scalar(q) or 0.0), 2)


def candidate_burned_stake_pct(db: Session, author_id: int) -> float:
    """Sum of risk_percent from cult signals closed at stop loss (permanently burned)."""
    from app.signal_stake_pool import _signal_stake_expr

    q = select(func.coalesce(func.sum(_signal_stake_expr()), 0.0)).where(
        Signal.status == "lose",
        Signal.is_cult_candidate.is_(True),
        Signal.author_telegram_id == author_id,
    )
    return round(float(db.scalar(q) or 0.0), 2)


def candidate_stake_pool_snapshot(
    db: Session,
    trader,
    author_id: int,
    *,
    exclude_signal_id: int | None = None,
) -> dict[str, float | int | str]:
    from app.rank_constants import DEFAULT_RANK_ID, rank_max_leverage, rank_name
    from app.rank_service import ensure_rank_fields
    from app.signal_stake_pool import rank_max_stake_pct

    ensure_rank_fields(trader)
    rank_id = trader.current_rank_id or DEFAULT_RANK_ID
    burned = candidate_burned_stake_pct(db, author_id)
    capacity = round(max(0.0, 100.0 - burned), 2)
    used = candidate_active_stake_used(db, author_id, exclude_signal_id=exclude_signal_id)
    remaining = round(max(0.0, capacity - used), 2)
    rank_cap = rank_max_stake_pct(rank_id)
    from app.signal_stake_pool import author_has_full_rank_entry_locked

    rank_locked = author_has_full_rank_entry_locked(
        db,
        author_id,
        rank_cap,
        cult=True,
        exclude_signal_id=exclude_signal_id,
    )
    block_new = rank_locked and exclude_signal_id is None
    rank_available = round(max(0.0, rank_cap - used), 2)
    max_stake = 0.0 if block_new else round(min(rank_available, remaining), 2)
    return {
        "current_rank_id": rank_id,
        "current_rank_name": rank_name(rank_id),
        "rank_max_stake_pct": rank_cap,
        "rank_max_leverage": rank_max_leverage(rank_id),
        "stake_pool_burned_pct": burned,
        "stake_pool_capacity_pct": capacity,
        "stake_pool_used_pct": used,
        "stake_pool_remaining_pct": remaining,
        "rank_entry_locked": rank_locked,
        "max_stake_pct": max_stake,
    }


def candidate_signals_today_count(db: Session, author_id: int) -> int:
    from app.daily_stop_limit import msk_day_key

    today_key = msk_day_key(_now())
    if not today_key:
        return 0
    rows = db.scalars(
        select(Signal).where(
            Signal.author_telegram_id == author_id,
            Signal.is_cult_candidate.is_(True),
        )
    ).all()
    return sum(1 for s in rows if msk_day_key(s.created_at) == today_key)


def _candidate_signal_stop_budget_consumed(sig: Signal, rank_max: float) -> float:
    """Дневной бюджет, потреблённый закрытым сигналом кандидата.

    Заморозка = price_stop% × lev (независимо от размера позиции).
    Стоп 0.93% при 1× → потребляет 0.93% из 2% лимита.
    """
    from app.daily_stop_limit import price_stop_to_reserved_rank_pct, signal_price_stop_pct
    from app.trader_stats import closed_signal_move_pct, signal_leverage

    if sig.status not in ("win", "lose"):
        return 0.0
    if sig.close_reason == "target":
        return 0.0
    lev = signal_leverage(sig)
    if sig.close_reason == "market" and sig.status == "lose":
        move = abs(closed_signal_move_pct(sig))
        return price_stop_to_reserved_rank_pct(move, lev)
    if sig.status == "lose":
        return price_stop_to_reserved_rank_pct(signal_price_stop_pct(sig), lev)
    return 0.0


def candidate_stop_consumed_rank_pct(
    db: Session,
    author_id: int,
    balance: float,
    rank_max_stake_pct_val: float,
) -> float:
    from app.daily_stop_limit import SIGNAL_DAILY_STOP_LIMIT_PCT, msk_day_key

    today_key = msk_day_key(_now())
    if not today_key:
        return 0.0
    total = 0.0
    rows = db.scalars(
        select(Signal).where(
            Signal.author_telegram_id == author_id,
            Signal.status.in_(("win", "lose")),
            Signal.is_cult_candidate.is_(True),
        )
    ).all()
    for sig in rows:
        if msk_day_key(sig.closed_at) != today_key:
            continue
        total += _candidate_signal_stop_budget_consumed(sig, 0.0)
    return round(min(total, SIGNAL_DAILY_STOP_LIMIT_PCT), 2)


def candidate_active_stop_reserved_rank_pct(
    db: Session,
    author_id: int,
    balance: float,
    rank_max_stake_pct_val: float,
    *,
    exclude_signal_id: int | None = None,
) -> float:
    from app.daily_stop_limit import (
        SIGNAL_DAILY_STOP_LIMIT_PCT,
        price_stop_to_reserved_rank_pct,
        signal_price_stop_pct,
    )
    from app.trader_stats import signal_leverage

    total = 0.0
    for sig in _candidate_active_signals(db, author_id):
        if exclude_signal_id is not None and sig.id == exclude_signal_id:
            continue
        total += price_stop_to_reserved_rank_pct(signal_price_stop_pct(sig), signal_leverage(sig))
    return round(min(total, SIGNAL_DAILY_STOP_LIMIT_PCT), 2)


def candidate_daily_stop_form_state(
    db: Session,
    author_id: int,
    balance: float,
    rank_max_stake_pct_val: float,
    *,
    exclude_signal_id: int | None = None,
) -> dict[str, float]:
    from app.daily_stop_limit import (
        RANK_NOMINAL_LEVERAGE_FOR_DAILY,
        daily_stop_remaining_rank_pct,
        rank_nominal_usd,
    )

    rank_nominal_ref = rank_nominal_usd(balance, rank_max_stake_pct_val, RANK_NOMINAL_LEVERAGE_FOR_DAILY)
    consumed_rank_pct = candidate_stop_consumed_rank_pct(db, author_id, balance, rank_max_stake_pct_val)
    reserved_rank_pct = candidate_active_stop_reserved_rank_pct(
        db,
        author_id,
        balance,
        rank_max_stake_pct_val,
        exclude_signal_id=exclude_signal_id,
    )
    remaining_rank_pct = daily_stop_remaining_rank_pct(
        consumed_rank_pct,
        reserved_rank_pct=reserved_rank_pct,
    )
    consumed_usd = (
        round(consumed_rank_pct / 100.0 * rank_nominal_ref, 2) if rank_nominal_ref > 0 else 0.0
    )
    return {
        "rank_nominal_usd": rank_nominal_ref,
        "consumed_rank_pct": consumed_rank_pct,
        "consumed_usd": consumed_usd,
        "reserved_rank_pct": reserved_rank_pct,
        "remaining_rank_pct": remaining_rank_pct,
    }


def build_candidate_form_snapshot(
    db: Session,
    sub: Subscriber,
    *,
    exclude_signal_id: int | None = None,
) -> CultCandidateFormSnapshot:
    from app.daily_stop_limit import SIGNAL_DAILY_TRADE_LIMIT
    from app.signal_service import get_or_create_trader

    ensure_can_trade(db, sub)
    balance = cult_candidate_account_size(db, sub.telegram_user_id)
    trader = get_or_create_trader(db, sub.telegram_user_id, None)
    pool = candidate_stake_pool_snapshot(
        db,
        trader,
        sub.telegram_user_id,
        exclude_signal_id=exclude_signal_id,
    )
    rank_cap = float(pool["rank_max_stake_pct"])
    stop_state = candidate_daily_stop_form_state(
        db,
        sub.telegram_user_id,
        balance,
        rank_cap,
        exclude_signal_id=exclude_signal_id,
    )
    return CultCandidateFormSnapshot(
        balance=balance,
        account_size=balance,
        daily_loss_usd=float(stop_state["consumed_usd"]),
        daily_trades_count=candidate_signals_today_count(db, sub.telegram_user_id),
        daily_trades_limit=SIGNAL_DAILY_TRADE_LIMIT,
        current_rank_id=int(pool["current_rank_id"]),
        current_rank_name=str(pool["current_rank_name"]),
        rank_max_stake_pct=float(pool["rank_max_stake_pct"]),
        rank_max_leverage=int(pool["rank_max_leverage"]),
        daily_stop_reserved_rank_pct=float(stop_state["reserved_rank_pct"]),
        daily_stop_remaining_rank_pct=float(stop_state["remaining_rank_pct"]),
        stake_pool_burned_pct=float(pool["stake_pool_burned_pct"]),
        stake_pool_capacity_pct=float(pool["stake_pool_capacity_pct"]),
        stake_pool_used_pct=float(pool["stake_pool_used_pct"]),
        stake_pool_remaining_pct=float(pool["stake_pool_remaining_pct"]),
        rank_entry_locked=bool(pool.get("rank_entry_locked")),
        max_stake_pct=float(pool["max_stake_pct"]),
    )


def validate_candidate_signal_stake(
    db: Session,
    author_id: int,
    stake_pct: float,
    *,
    exclude_signal_id: int | None = None,
) -> None:
    from fastapi import HTTPException, status

    from app.signal_service import get_or_create_trader

    if stake_pct <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Сумма входа должна быть больше 0%",
        )
    trader = get_or_create_trader(db, author_id, None)
    snap = candidate_stake_pool_snapshot(db, trader, author_id, exclude_signal_id=exclude_signal_id)
    rank_cap = float(snap["rank_max_stake_pct"])
    pool_left = float(snap["stake_pool_remaining_pct"])
    max_allowed = float(snap["max_stake_pct"])
    if snap.get("rank_entry_locked") and exclude_signal_id is None:
        from app.signal_stake_pool import rank_entry_locked_message

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=rank_entry_locked_message(rank_cap),
        )
    if stake_pct > rank_cap + 0.001:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Максимум {rank_cap:g}% входа для ранга «{snap['current_rank_name']}»",
        )
    if stake_pct > pool_left + 0.001:
        used = float(snap["stake_pool_used_pct"])
        if pool_left <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="100% пула суммы входа уже занято вашими активными сделками",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"В пуле занято {used:g}% суммы входа — доступно {pool_left:g}%",
        )
    if stake_pct > max_allowed + 0.001:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Максимальная сумма входа сейчас {max_allowed:g}%",
        )


def validate_candidate_signal_leverage(db: Session, author_id: int, leverage: int) -> None:
    from fastapi import HTTPException, status

    from app.rank_constants import MAX_SIGNAL_LEVERAGE, rank_max_leverage, rank_name
    from app.rank_service import ensure_rank_fields
    from app.signal_service import get_or_create_trader

    lev = max(1, min(int(leverage or 1), MAX_SIGNAL_LEVERAGE))
    trader = get_or_create_trader(db, author_id, None)
    ensure_rank_fields(trader)
    rank_id = trader.current_rank_id or 8
    max_lev = rank_max_leverage(rank_id)
    if lev > max_lev:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Для ранга «{rank_name(rank_id)}» доступно плечо до {max_lev}×",
        )


def validate_candidate_signal_daily_trades(db: Session, author_id: int) -> None:
    from fastapi import HTTPException, status

    from app.daily_stop_limit import SIGNAL_DAILY_TRADE_LIMIT

    count = candidate_signals_today_count(db, author_id)
    if count >= SIGNAL_DAILY_TRADE_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Лимит дня: {SIGNAL_DAILY_TRADE_LIMIT} сделки — "
                f"сделок сегодня уже {count}"
            ),
        )


def validate_candidate_signal_daily_stop(
    db: Session,
    author_id: int,
    entry_low: str | None,
    entry_high: str | None,
    stop_loss: str | None,
    stake_pct: float,
    leverage: int,
    *,
    exclude_signal_id: int | None = None,
) -> None:
    from fastapi import HTTPException, status

    from app.daily_stop_limit import (
        ACCOUNT_STOP_MIN_STEP,
        SIGNAL_DAILY_STOP_LIMIT_PCT,
        SIGNAL_DAILY_TRADE_LIMIT,
        compute_signal_points_percent,
        daily_stop_budget_usd,
        price_stop_to_reserved_rank_pct,
    )
    from app.signal_service import get_or_create_trader

    _ = stake_pct
    balance = cult_candidate_account_size(db, author_id)
    trader = get_or_create_trader(db, author_id, None)
    snap = candidate_stake_pool_snapshot(db, trader, author_id, exclude_signal_id=exclude_signal_id)
    rank_cap = float(snap["rank_max_stake_pct"])
    stop_state = candidate_daily_stop_form_state(
        db,
        author_id,
        balance,
        rank_cap,
        exclude_signal_id=exclude_signal_id,
    )
    rank_nominal = stop_state["rank_nominal_usd"]
    consumed_pct = stop_state["consumed_rank_pct"]
    remaining_pct = stop_state["remaining_rank_pct"]
    reserved_pct = stop_state["reserved_rank_pct"]
    if remaining_pct < ACCOUNT_STOP_MIN_STEP:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Лимит дня: {SIGNAL_DAILY_TRADE_LIMIT} сделки или "
                f"{SIGNAL_DAILY_STOP_LIMIT_PCT:g}% стопа от номинала ранга — дневной стоп исчерпан "
                f"(использовано {consumed_pct:g}%, заморожено {reserved_pct:g}%, "
                f"лимит ${daily_stop_budget_usd(rank_nominal):g})"
            ),
        )
    if not stop_loss:
        return
    price_stop_pct = compute_signal_points_percent(entry_low, entry_high, stop_loss)
    needed_rank_pct = price_stop_to_reserved_rank_pct(price_stop_pct, leverage)
    if needed_rank_pct > remaining_pct + 0.01:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Стоп {price_stop_pct:g}% цены занимает {needed_rank_pct:g}% дневного лимита "
                f"({SIGNAL_DAILY_STOP_LIMIT_PCT:g}% макс.), остаток {remaining_pct:g}% "
                f"(использовано {consumed_pct:g}%, заморожено {reserved_pct:g}%)"
            ),
        )


def get_candidate_owned_signal(db: Session, signal_id: int, author_id: int) -> Signal:
    row = db.get(Signal, signal_id)
    if row is None or not row.is_cult_candidate or row.author_telegram_id != author_id:
        raise ValueError("Сделка не найдена")
    return row


def ensure_can_trade(db: Session, sub: Subscriber) -> CultCandidate:
    from datetime import datetime, timezone
    from app.trader_roster_service import (
        cult_subscription_admin_bypass,
        is_main_feed_publisher,
        is_roster_demoted_admin,
    )

    if is_main_feed_publisher(db, sub.telegram_user_id):
        raise ValueError("Вы в ТОП — публикуйте сигналы в основную ленту")

    bypass = cult_subscription_admin_bypass(db, sub.telegram_user_id)

    # Демотированный админ: авто-создаём запись кандидата если нет
    if is_roster_demoted_admin(db, sub.telegram_user_id):
        row = db.get(CultCandidate, sub.telegram_user_id)
        if row is None:
            from app.models import Trader
            from app.serializers import trader_display_name
            trader = db.get(Trader, sub.telegram_user_id)
            name = trader_display_name(trader, trader.username if trader else None) or f"Admin{sub.telegram_user_id}"
            row = CultCandidate(
                telegram_user_id=sub.telegram_user_id,
                display_name=name[:64],
                enabled=True,
                joined_at=datetime.now(timezone.utc),
                rating_percent=float(trader.rating_percent or 0) if trader else 0.0,
                wins=int(trader.wins or 0) if trader else 0,
                losses=int(trader.losses or 0) if trader else 0,
            )
            db.add(row)
            db.flush()
        elif not row.enabled:
            row.enabled = True
        blockers = _trade_access_blockers(db, sub, cult_admin_bypass=bypass)
        if blockers:
            raise ValueError(blockers[0])
        return row

    row = db.get(CultCandidate, sub.telegram_user_id)
    if row is None or not row.enabled:
        raise ValueError("Сначала станьте кандидатом в CULT")
    blockers = _trade_access_blockers(db, sub, cult_admin_bypass=bypass)
    if blockers:
        raise ValueError(blockers[0])
    return row
