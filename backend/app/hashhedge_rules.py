"""Правила челленджа Hash Hedge (https://www.hashhedge.com/)."""

from dataclasses import dataclass
from typing import Callable


@dataclass(frozen=True)
class StageRules:
    stage: int
    profit_target_pct: float | None
    max_daily_loss_pct: float
    max_drawdown_pct: float
    min_trading_days: int | None
    trading_period_unlimited: bool
    max_leverage: str


HASHHEDGE_STAGES: dict[int, StageRules] = {
    1: StageRules(1, 8.0, 5.0, 10.0, 5, True, "1:5"),
    2: StageRules(2, 6.0, 5.0, 8.0, 5, True, "1:5"),
    3: StageRules(3, None, 5.0, 8.0, None, True, "1:5"),
}

ACCOUNT_SIZES = [5_000, 10_000, 25_000, 50_000, 100_000, 150_000]

INFINITY = "∞"


def rules_for_stage(stage: int) -> StageRules:
    return HASHHEDGE_STAGES.get(stage, HASHHEDGE_STAGES[1])


def _fmt_pct(value: float | None) -> str:
    if value is None:
        return INFINITY
    return f"{value:g}%"


def _fmt_days(value: int | None) -> str:
    if value is None:
        return INFINITY
    return str(value)


def _fmt_leverage(value: str) -> str:
    return value


RULE_TABLE_ROWS: list[tuple[str, str, str, Callable[[StageRules], str]]] = [
    (
        "profit_target",
        "Целевая прибыль",
        "Процент прибыли от стартового баланса для перехода на следующий этап.",
        lambda s: _fmt_pct(s.profit_target_pct),
    ),
    (
        "max_daily_loss",
        "Максимальная потеря в день",
        "Максимальный убыток за торговый день в % от баланса на начало дня.",
        lambda s: _fmt_pct(s.max_daily_loss_pct),
    ),
    (
        "max_drawdown",
        "Макс просадка",
        "Максимальная просадка от начального депозита челленджа.",
        lambda s: _fmt_pct(s.max_drawdown_pct),
    ),
    (
        "min_trading_days",
        "Мин. торговые дни",
        "Минимальное число дней с хотя бы одной сделкой для прохождения этапа.",
        lambda s: _fmt_days(s.min_trading_days),
    ),
    (
        "trading_period",
        "Торговый период",
        "Срок прохождения этапа; без ограничения по времени.",
        lambda s: INFINITY if s.trading_period_unlimited else "—",
    ),
    (
        "max_leverage",
        "Максимальное кредитное плечо",
        "Допустимое плечо на крипто-парах.",
        lambda s: _fmt_leverage(s.max_leverage),
    ),
]


def rules_payload() -> dict:
    stages = [HASHHEDGE_STAGES[i] for i in (1, 2, 3)]
    return {
        "firm": "Hash Hedge",
        "url": "https://www.hashhedge.com/",
        "account_sizes": ACCOUNT_SIZES,
        "stages": [
            {
                "stage": s.stage,
                "profit_target_pct": s.profit_target_pct,
                "profit_target_unlimited": s.profit_target_pct is None,
                "max_daily_loss_pct": s.max_daily_loss_pct,
                "max_drawdown_pct": s.max_drawdown_pct,
                "min_trading_days": s.min_trading_days,
                "min_trading_days_unlimited": s.min_trading_days is None,
                "trading_period_unlimited": s.trading_period_unlimited,
                "max_leverage": s.max_leverage,
            }
            for s in stages
        ],
        "table_rows": [
            {
                "id": row_id,
                "label": label,
                "hint": hint,
                "values": [fmt(s) for s in stages],
            }
            for row_id, label, hint, fmt in RULE_TABLE_ROWS
        ],
    }
