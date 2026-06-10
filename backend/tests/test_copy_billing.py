from app.copy_billing import (
    billing_snapshot,
    copy_baseline_unset,
    ensure_baseline_on_connect,
    fee_from_profit,
    profit_since_connect,
    sync_copy_baseline_if_no_trades,
    unbilled_profit,
    user_has_copy_trades,
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


def test_profit_zero_without_copy_trades():
    sub = Subscriber(telegram_user_id=4, copy_equity_baseline_usd=0.0, copy_billed_profit_usd=0.0)
    row = UserBybitSettings(
        telegram_user_id=4,
        api_key_encrypted="x",
        api_secret_encrypted="y",
        last_equity_usd=42.0,
    )

    class _Db:
        def get(self, _model, uid):
            return sub if uid == 4 else None

        def scalar(self, _query):
            return 0

    snap = billing_snapshot(_Db(), 4, row, current_equity=42.0)
    assert snap["profit_usd"] == 0.0
    assert snap["unbilled_profit_usd"] == 0.0


def test_sync_baseline_resets_profit_before_first_copy():
    sub = Subscriber(telegram_user_id=5, copy_equity_baseline_usd=0.0, copy_billed_profit_usd=5.0)
    row = UserBybitSettings(
        telegram_user_id=5,
        api_key_encrypted="x",
        api_secret_encrypted="y",
        last_equity_usd=0.0,
    )

    class _EmptyDb:
        def scalar(self, _query):
            return 0

    sync_copy_baseline_if_no_trades(_EmptyDb(), 5, sub, row, 42.0)
    assert sub.copy_equity_baseline_usd == 42.0
    assert sub.copy_billed_profit_usd == 0.0
    assert row.last_equity_usd == 42.0
