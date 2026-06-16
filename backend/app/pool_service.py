"""Виртуальный пул проекта: распределение между трейдерами и кандидатами.

Структура 100%:
  20% → проект
  70% → топ-трейдеры (по рангу, позиции в рейтинге, % за неделю; штраф за убыт. недели)
  10% → топ-3 кандидата Волнового (50 / 30 / 20% от этой части)

Баланс пула = $100 000 (старт) + суммарный realized_pnl всех закрытых сигналов.
Прибыльные сделки увеличивают пул, убыточные — уменьшают.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.rank_constants import RANKS_BEST_TO_WORST

POOL_INITIAL_USD: float = 100_000.0

PROJECT_SHARE: float = 0.20
TRADERS_SHARE: float = 0.70
CANDIDATES_SHARE: float = 0.10

# Раздел 10% между топ-3 кандидатами: 50% / 30% / 20%
CANDIDATE_TOP_SPLIT: dict[int, float] = {1: 0.50, 2: 0.30, 3: 0.20}


def get_pool_balance(db: Session) -> float:
    """Пул = $100 000 + сумма P/L всех закрытых сигналов ТОП-трейдеров (база Volnovoi $100k).

    Каждая сделка: stake% × $100k × leverage × move% / 100 — то же что «доходность» у Volnovoi.
    Сделки кандидатов на пул не влияют.
    """
    from app.models import Signal
    from app.volnovoi_account import volnovoi_signal_pnl_usd

    signals = db.scalars(
        select(Signal).where(
            Signal.status.in_(("win", "lose")),
            Signal.is_cult_candidate.is_not(True),
        ).order_by(Signal.closed_at.asc())
    ).all()

    balance = POOL_INITIAL_USD
    for sig in signals:
        balance = round(balance + volnovoi_signal_pnl_usd(sig), 2)

    return max(0.0, balance)


def _quality_index(rank_id: int) -> int:
    try:
        return RANKS_BEST_TO_WORST.index(rank_id)
    except ValueError:
        return len(RANKS_BEST_TO_WORST) - 1


def _trader_score(rank_id: int, position: int, weekly_pct: float, consecutive_loss_weeks: int) -> float:
    """Балл трейдера для распределения 70% пула.

    rank_points: чем лучше ранг — тем больше (макс. 10, мин. 1).
    position_points: 10 / место в таблице (1-е = 10, 2-е = 5, ...).
    weekly_bonus: % за неделю если положительный.
    penalty: ×0.5 за каждую убыточную неделю подряд.
    """
    rank_points = max(1, 10 - _quality_index(rank_id))
    position_points = 10.0 / max(1, position)
    weekly_bonus = max(0.0, weekly_pct)
    penalty = max(0.25, 1.0 - 0.25 * consecutive_loss_weeks)
    return (rank_points + position_points + weekly_bonus) * penalty


def calculate_trader_pool_shares(
    trader_reads: list,
    pool_balance: float,
) -> dict[int, float]:
    """Вернуть {telegram_id: share_usd} для 70% пула.

    Принимает список TraderRead; агрегатная карточка Волнового исключается.
    """
    scores: dict[int, float] = {}
    for t in trader_reads:
        if getattr(t, "is_aggregate", False):
            continue
        rank_id = t.trader_rank.current_rank_id if t.trader_rank else 8
        weekly_pct = t.trader_rank.weekly_pct if t.trader_rank else 0.0
        consecutive = t.trader_rank.consecutive_loss_weeks if t.trader_rank else 0
        score = _trader_score(rank_id, t.rank or 1, weekly_pct, consecutive)
        scores[t.telegram_id] = score

    total = sum(scores.values())
    if not total:
        return {}
    budget = pool_balance * TRADERS_SHARE
    return {tid: round(score / total * budget, 2) for tid, score in scores.items()}


def calculate_candidate_pool_shares(pool_balance: float) -> dict[int, float]:
    """Вернуть {место: share_usd} для топ-3 кандидатов из 10% пула."""
    budget = pool_balance * CANDIDATES_SHARE
    return {rank: round(split * budget, 2) for rank, split in CANDIDATE_TOP_SPLIT.items()}


def combined_candidate_pool_shares(db: Session) -> dict[int, float]:
    """Топ-3 из объединённого списка: cult_candidates + demoted admins — {telegram_id: share_usd}.

    Все кандидаты (включая демотированных админов) ранжируются вместе по rating_percent/wins.
    Первые три места получают 50/30/20% от 10% пула.
    """
    from app.models import CultCandidate, Trader
    from app.trader_roster_service import ROSTER_FIRED, ROSTER_TOP, demoted_admin_ids, roster_overrides_map

    pool_balance = get_pool_balance(db)
    budget = pool_balance * CANDIDATES_SHARE
    overrides = roster_overrides_map(db)

    # Обычные cult-кандидаты (не переведены в ТОП или уволены)
    cult_rows = db.scalars(
        select(CultCandidate).where(CultCandidate.enabled.is_(True))
    ).all()
    entries: list[tuple[int, float, int]] = []  # (telegram_id, rating_pct, wins)
    for c in cult_rows:
        if overrides.get(c.telegram_user_id) in (ROSTER_TOP, ROSTER_FIRED):
            continue
        entries.append((c.telegram_user_id, float(c.rating_percent or 0), int(c.wins or 0)))

    # Демотированные админы
    for tid in demoted_admin_ids(db):
        if any(e[0] == tid for e in entries):
            continue  # уже есть как cult-кандидат
        trader = db.get(Trader, tid)
        entries.append((
            tid,
            float(trader.rating_percent or 0) if trader else 0.0,
            int(trader.wins or 0) if trader else 0,
        ))

    ranked = sorted(entries, key=lambda x: (-x[1], -x[2]))
    result: dict[int, float] = {}
    for pos, (tid, _, _) in enumerate(ranked[:3], start=1):
        split = CANDIDATE_TOP_SPLIT.get(pos, 0.0)
        result[tid] = round(split * budget, 2)
    return result
