"""Пользователи-кандидаты CULT: регистрация, сигналы, статистика %."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.copy_trading_service import copy_deposit_base_usd
from app.models import CultCandidate, Signal, UserBybitSettings
from app.schemas import (
    CultCandidateActiveSignalRead,
    CultCandidateClosedSignalRead,
    CultCandidateMeRead,
    CultCandidateRead,
    TelegramUser,
    TraderDayStat,
)
from app.serializers import trader_avatar_url, trader_display_name, trader_login
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


def join_blockers(db: Session, sub: Subscriber, *, cult_admin_bypass: bool = False) -> list[str]:
    from app.trader_roster_service import is_main_feed_publisher

    if is_main_feed_publisher(db, sub.telegram_user_id):
        return ["Админы в ТОП публикуют в основную ленту"]
    if is_cult_candidate(db, sub.telegram_user_id):
        return []
    if not cult_subscription_active(sub, is_admin=cult_admin_bypass):
        return ["Нужна подписка кандидата CULT ($20 / 30 дней)"]
    bybit = db.get(UserBybitSettings, sub.telegram_user_id)
    if bybit is None:
        return ["Подключите API Bybit"]
    return []


def ensure_cult_candidate_for_demoted_admin(db: Session, telegram_id: int) -> CultCandidate | None:
    """При переводе админа в кандидаты — запись CULT для публикации по правилам кандидатов."""
    from app.trader_roster_service import is_roster_demoted_admin

    if not is_roster_demoted_admin(db, telegram_id):
        return None
    from app.signal_service import get_or_create_trader

    trader = get_or_create_trader(db, telegram_id, None)
    name = display_name_from_telegram(
        first_name=trader.first_name,
        last_name=trader.last_name,
        username=trader.username,
    )
    existing = db.get(CultCandidate, telegram_id)
    if existing:
        existing.display_name = name
        existing.enabled = True
        return existing
    row = CultCandidate(
        telegram_user_id=telegram_id,
        display_name=name,
        joined_at=_now(),
    )
    db.add(row)
    db.flush()
    return row


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
    close_reason = "target" if final_outcome == "win" else "stop"
    signal.status = final_outcome
    signal.closed_at = _now()
    signal.closed_exit_price = exit_price
    signal.close_reason = close_reason

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
        stake = s.risk_percent if s.risk_percent is not None else 10.0
        if s.entry_low and s.entry_high and s.entry_low != s.entry_high:
            entry = f"{s.entry_low}–{s.entry_high}"
        else:
            entry = s.entry_low or s.entry_high or "—"
        if s.entry_filled_at is None:
            level_label = "ожидание входа"
        elif s.stop_loss:
            level_label = f"стоп {s.stop_loss}"
        elif s.take_profits:
            tp = (s.take_profits or "").split(",")[0].strip()
            level_label = f"цель {tp}" if tp else "цель —"
        else:
            level_label = "по рынку"
        out[s.author_telegram_id].append(
            CultCandidateActiveSignalRead(
                id=s.id,
                symbol=s.symbol,
                direction=s.direction,
                entry=entry,
                level_label=level_label,
                stake_percent=float(stake),
            )
        )
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
) -> CultCandidateRead:
    from app.models import Trader

    trader = db.get(Trader, row.telegram_user_id)
    total = (row.wins or 0) + (row.losses or 0)
    wr = round((row.wins or 0) / total * 100, 1) if total else 0.0
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
        is_me=is_me,
    )


def build_cult_candidates_read(db: Session, *, viewer_id: int | None = None) -> list[CultCandidateRead]:
    from app.trader_roster_service import ROSTER_FIRED, ROSTER_TOP, roster_overrides_map

    overrides = roster_overrides_map(db)
    rows = list(db.scalars(select(CultCandidate).where(CultCandidate.enabled.is_(True))).all())
    rows = [
        r
        for r in rows
        if overrides.get(r.telegram_user_id) not in (ROSTER_TOP, ROSTER_FIRED)
    ]
    if not rows:
        return []
    ids = [r.telegram_user_id for r in rows]
    daily = _daily_stats(db, ids)
    active = _active_signals_for(db, ids)
    closed = _closed_signals_for(db, ids)
    ranked = sorted(rows, key=lambda c: (-(c.rating_percent or 0), -(c.wins or 0)))
    return [
        _candidate_read(
            db,
            row,
            rank=rank,
            daily=daily,
            active=active,
            closed=closed,
            is_me=viewer_id is not None and row.telegram_user_id == viewer_id,
        )
        for rank, row in enumerate(ranked, start=1)
    ]


def build_cult_candidate_me_read(db: Session, sub: Subscriber) -> CultCandidateMeRead:
    from app.trader_roster_service import cult_subscription_admin_bypass

    row = db.get(CultCandidate, sub.telegram_user_id)
    bypass = cult_subscription_admin_bypass(db, sub.telegram_user_id)
    blockers = join_blockers(db, sub, cult_admin_bypass=bypass)
    bybit = db.get(UserBybitSettings, sub.telegram_user_id)
    return CultCandidateMeRead(
        is_candidate=row is not None and bool(row.enabled),
        display_name=row.display_name if row else None,
        can_join=len(blockers) == 0,
        blockers=blockers,
        bybit_configured=bybit is not None,
        cult_subscription_active=cult_subscription_active(sub, is_admin=bypass),
        cult_subscription_until=sub.cult_subscription_until,
    )


def cult_candidate_account_size(db: Session, telegram_id: int) -> float:
    bybit = db.get(UserBybitSettings, telegram_id)
    if bybit is None:
        return 10_000.0
    return copy_deposit_base_usd(bybit)


def ensure_can_trade(db: Session, sub: Subscriber) -> CultCandidate:
    from app.trader_roster_service import cult_subscription_admin_bypass, is_main_feed_publisher

    if is_main_feed_publisher(db, sub.telegram_user_id):
        raise ValueError("Вы в ТОП — публикуйте сигналы в основную ленту")
    row = db.get(CultCandidate, sub.telegram_user_id)
    if row is None or not row.enabled:
        raise ValueError("Сначала станьте кандидатом в CULT")
    bypass = cult_subscription_admin_bypass(db, sub.telegram_user_id)
    blockers = join_blockers(db, sub, cult_admin_bypass=bypass)
    if blockers:
        raise ValueError(blockers[0])
    return row
