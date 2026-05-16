"""Правила челленджа Hash Hedge (https://www.hashhedge.com/)."""

from dataclasses import dataclass


@dataclass(frozen=True)
class StageRules:
    stage: int
    profit_target_pct: float
    max_daily_loss_pct: float
    max_drawdown_pct: float
    min_trading_days: int
    max_leverage: str


# Этапы 1–2 — челлендж; этап 3 — funded (цели как stage 2 по лимитам на сайте)
HASHHEDGE_STAGES: dict[int, StageRules] = {
    1: StageRules(1, 8.0, 5.0, 10.0, 5, "1:5"),
    2: StageRules(2, 6.0, 5.0, 8.0, 5, "1:5"),
    3: StageRules(3, 6.0, 5.0, 8.0, 0, "1:5"),
}

ACCOUNT_SIZES = [5_000, 10_000, 25_000, 50_000, 100_000, 150_000]


def rules_for_stage(stage: int) -> StageRules:
    return HASHHEDGE_STAGES.get(stage, HASHHEDGE_STAGES[1])


def rules_payload() -> dict:
    return {
        "firm": "Hash Hedge",
        "url": "https://www.hashhedge.com/",
        "account_sizes": ACCOUNT_SIZES,
        "stages": [
            {
                "stage": s.stage,
                "profit_target_pct": s.profit_target_pct,
                "max_daily_loss_pct": s.max_daily_loss_pct,
                "max_drawdown_pct": s.max_drawdown_pct,
                "min_trading_days": s.min_trading_days,
                "max_leverage": s.max_leverage,
            }
            for s in HASHHEDGE_STAGES.values()
        ],
        "notes": [
            "Дневной лимит: убыток за день не более % от баланса на начало дня.",
            "Макс. просадка: от начального депозита челленджа.",
            "Плечо до 1:5 на крипто-парах.",
            "Цель этапа 1: +8%, этапа 2: +6%.",
        ],
    }
