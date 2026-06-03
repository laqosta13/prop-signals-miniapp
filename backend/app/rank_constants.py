from __future__ import annotations

from dataclasses import dataclass
from typing import Final


@dataclass(frozen=True)
class TraderRankDef:
    id: int
    name: str
    min_pct: float
    max_pct: float


TRADER_RANKS: Final[tuple[TraderRankDef, ...]] = (
    TraderRankDef(8, "Нулёвый", float("-inf"), 0.0),
    TraderRankDef(7, "В рынке", 0.0, 3.0),
    TraderRankDef(6, "На волне", 3.0, 7.0),
    TraderRankDef(5, "Зелёная зона", 7.0, 12.0),
    TraderRankDef(4, "Хищник", 12.0, 18.0),
    TraderRankDef(3, "Большой Шорт", 18.0, 25.0),
    TraderRankDef(2, "Волк с Уолл-Стрит", 25.0, 30.0),
    TraderRankDef(1, "Легенда", 30.0, 50.0),
    TraderRankDef(9, "Сатоши Накамото", 50.0, 100.0),
    TraderRankDef(10, "Тот самый глаз пирамиды", 100.0, float("inf")),
)

RANK_BY_ID: Final[dict[int, TraderRankDef]] = {r.id: r for r in TRADER_RANKS}

# От лучшего к худшему (10 — вершина).
RANKS_BEST_TO_WORST: Final[tuple[int, ...]] = (10, 9, 1, 2, 3, 4, 5, 6, 7, 8)

DEFAULT_RANK_ID = 8

# Макс. сумма входа % в одном сигнале по рангу.
RANK_MAX_STAKE_PCT: Final[dict[int, float]] = {
    10: 100.0,
    9: 100.0,
    1: 50.0,
    2: 45.0,
    3: 40.0,
    4: 35.0,
    5: 30.0,
    6: 25.0,
    7: 20.0,
    8: 15.0,
}


def rank_quality_index(rank_id: int) -> int:
    try:
        return RANKS_BEST_TO_WORST.index(rank_id)
    except ValueError:
        return len(RANKS_BEST_TO_WORST) - 1


def clamp_rank_id(rank_id: int) -> int:
    idx = max(0, min(rank_quality_index(rank_id), len(RANKS_BEST_TO_WORST) - 1))
    return RANKS_BEST_TO_WORST[idx]


def better_rank(a: int, b: int) -> bool:
    """True, если ранг a строго выше ранга b."""
    return rank_quality_index(a) < rank_quality_index(b)


def rank_one_step_better(rank_id: int) -> int:
    idx = rank_quality_index(rank_id)
    if idx <= 0:
        return rank_id
    return RANKS_BEST_TO_WORST[idx - 1]


def rank_steps_worse(rank_id: int, steps: int) -> int:
    idx = min(rank_quality_index(rank_id) + steps, len(RANKS_BEST_TO_WORST) - 1)
    return RANKS_BEST_TO_WORST[idx]


def get_rank_by_pct(weekly_pct: float) -> int:
    for r in sorted(TRADER_RANKS, key=lambda x: -x.min_pct):
        if r.min_pct <= weekly_pct < r.max_pct:
            return r.id
    return DEFAULT_RANK_ID


def rank_name(rank_id: int) -> str:
    return RANK_BY_ID.get(rank_id, RANK_BY_ID[DEFAULT_RANK_ID]).name
