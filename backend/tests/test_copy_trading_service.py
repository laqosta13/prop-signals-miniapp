from types import SimpleNamespace

from app.copy_trading_service import (
    COPY_DEFAULT_SCALE_PCT,
    copy_effective_stake_pct,
    copy_notional_usd,
    copy_scale_pct,
)


def _settings(stake_percent: float | None = 100.0, equity: float = 5000.0) -> SimpleNamespace:
    return SimpleNamespace(
        stake_percent=stake_percent,
        last_equity_usd=equity,
        account_balance_usd=equity,
    )


def _signal(risk_percent: float = 15.0, leverage: int = 5) -> SimpleNamespace:
    return SimpleNamespace(risk_percent=risk_percent, leverage=leverage)


def test_copy_full_scale_matches_signal_risk_percent():
    """Панель 100% + сигнал 15% → вход на 15% депозита."""
    user = _settings(stake_percent=100.0, equity=5000.0)
    signal = _signal(risk_percent=15.0, leverage=5)
    assert copy_effective_stake_pct(user, signal) == 15.0
    assert copy_notional_usd(user, signal) == 3750.0


def test_copy_half_scale_scales_signal_stake():
    user = _settings(stake_percent=50.0, equity=10_000.0)
    signal = _signal(risk_percent=15.0, leverage=3)
    assert copy_effective_stake_pct(user, signal) == 7.5
    assert copy_notional_usd(user, signal) == 2250.0


def test_copy_notional_uses_balance_cents():
    user = _settings(stake_percent=100.0, equity=4977.50)
    signal = _signal(risk_percent=15.0, leverage=5)
    # 4977.50 * 15% * 5 / 100 = 3733.125 → 3733.13
    assert copy_notional_usd(user, signal) == 3733.13


def test_copy_scale_default_when_unset():
    user = _settings(stake_percent=0, equity=1000.0)
    signal = _signal(risk_percent=15.0, leverage=2)
    assert copy_scale_pct(user) == COPY_DEFAULT_SCALE_PCT
    assert copy_effective_stake_pct(user, signal) == 15.0
    assert copy_notional_usd(user, signal) == 300.0
