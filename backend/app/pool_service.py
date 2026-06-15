"""Виртуальный пул проекта: распределение между трейдерами и кандидатами.

Структура 100%:
  20% → проект
  70% → топ-трейдеры (по рангу, позиции в рейтинге, % за неделю; штраф за убыт. недели)
  10% → топ-3 кандидата Волнового (50 / 30 / 20% от этой части)

Баланс пула = $100 000 (старт) + суммарный realized_pnl всех закрытых сигналов.
Прибыльные сделки увеличивают пул, убыточные — уменьшают.
"""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.rank_constants import RANKS_BEST_TO_WORST

POOL_INITIAL_USD: float = 100_000.0

PROJECT_SHARE: float = 0.20
TRADERS_SHARE: float = 0.70
CANDIDATES_SHARE: float = 0.10

# Раздел 10% между топ-3 кандидатами: 50% / 30% / 20%
CANDIDATE_TOP_SPLIT: dict[int, float] = {1: 0.50, 2: 0.30, 3: 0.20}


def get_pool_balance(db: Session) -> float:
    """Баланс пула = $100 000 + суммарный realized_pnl закрытых сигналов."""
    from app.models import Signal

    total_pnl: float = db.scalar(
        select(func.sum(Signal.realized_pnl)).where(
            Signal.realized_pnl.is_not(None),
            Signal.status.in_(("win", "lose")),
        )
    ) or 0.0
    return round(max(0.0, POOL_INITIAL_USD + total_pnl), 2)


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
