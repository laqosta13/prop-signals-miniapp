from app.copy_billing import (
    copy_baseline_unset,
    ensure_baseline_on_connect,
    fee_from_profit,
    profit_since_connect,
    unbilled_profit,
)
from app.models import Subscriber, UserBybitSettings


class _FakeSession:
    pass


def test_profit_only_above_baseline():
    sub = Subscriber(telegram_user_id=1, copy_equity_baseline_usd=42.0, copy_billed_profit_usd=0.0)
    assert profit_since_connect(42.0, sub) == 0.0
    assert profit_since_connect(47.0, sub) == 5.0
    assert fee_from_profit(5.0) == 1.0
    assert unbilled_profit(47.0, sub) == 5.0


def test_zero_baseline_not_treated_as_set():
    sub = Subscriber(telegram_user_id=2, copy_equity_baseline_usd=0.0, copy_billed_profit_usd=0.0)
    assert copy_baseline_unset(sub)
    assert profit_since_connect(42.0, sub) == 0.0


def test_ensure_baseline_uses_current_equity_when_zero():
    sub = Subscriber(telegram_user_id=3, copy_equity_baseline_usd=0.0, copy_billed_profit_usd=0.0)
    row = UserBybitSettings(
        telegram_user_id=3,
        api_key_encrypted="x",
        api_secret_encrypted="y",
        last_equity_usd=None,
    )
    ensure_baseline_on_connect(_FakeSession(), sub, row, 42.0)
    assert sub.copy_equity_baseline_usd == 42.0
    assert profit_since_connect(47.0, sub) == 5.0
