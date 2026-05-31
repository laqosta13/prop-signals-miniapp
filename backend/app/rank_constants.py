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
    TraderRankDef(1, "Легенда", 30.0, float("inf")),
)

RANK_BY_ID: Final[dict[int, TraderRankDef]] = {r.id: r for r in TRADER_RANKS}

DEFAULT_RANK_ID = 8

# Макс. сумма входа % в одном сигнале по рангу (1 = Легенда — выше лимит).
RANK_MAX_STAKE_PCT: Final[dict[int, float]] = {
    1: 50.0,
    2: 45.0,
    3: 40.0,
    4: 35.0,
    5: 30.0,
    6: 25.0,
    7: 20.0,
    8: 15.0,
}


def rank_name(rank_id: int) -> str:
    return RANK_BY_ID.get(rank_id, RANK_BY_ID[DEFAULT_RANK_ID]).name
