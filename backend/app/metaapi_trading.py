"""MetaAPI REST client — торговля на MT4/MT5 через облако metaapi.cloud."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_BASE = "https://mt-client-api-v1.new-york.agiliumtrade.ai"
_httpx_client: httpx.AsyncClient | None = None


def _client() -> httpx.AsyncClient:
    global _httpx_client
    if _httpx_client is None or _httpx_client.is_closed:
        _httpx_client = httpx.AsyncClient(timeout=settings.price_http_timeout_seconds)
    return _httpx_client


def _headers(token: str) -> dict[str, str]:
    return {
        "auth-token": token,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


async def _get(token: str, path: str) -> Any:
    url = f"{_BASE}{path}"
    r = await _client().get(url, headers=_headers(token))
    if r.status_code == 401:
        raise RuntimeError("MetaAPI: неверный токен — проверьте METAAPI_TOKEN")
    if r.status_code == 404:
        raise RuntimeError("MetaAPI: аккаунт не найден — проверьте Account ID")
    if not r.is_success:
        try:
            msg = r.json().get("message") or r.text[:200]
        except Exception:
            msg = r.text[:200]
        raise RuntimeError(f"MetaAPI: {msg}")
    return r.json()


async def _post(token: str, path: str, body: dict[str, Any]) -> Any:
    url = f"{_BASE}{path}"
    r = await _client().post(url, json=body, headers=_headers(token))
    if r.status_code == 401:
        raise RuntimeError("MetaAPI: неверный токен — проверьте METAAPI_TOKEN")
    if r.status_code == 404:
        raise RuntimeError("MetaAPI: аккаунт не найден — проверьте Account ID")
    if not r.is_success:
        try:
            msg = r.json().get("message") or r.text[:200]
        except Exception:
            msg = r.text[:200]
        raise RuntimeError(f"MetaAPI: {msg}")
    return r.json()


async def get_account_info(token: str, account_id: str) -> dict[str, Any]:
    """Баланс и информация об аккаунте MT."""
    return await _get(token, f"/users/current/accounts/{account_id}/accountInformation")


async def place_trade(
    token: str,
    account_id: str,
    symbol: str,
    direction: str,
    volume: float,
    stop_loss: float | None = None,
    take_profit: float | None = None,
) -> str:
    """Открыть рыночный ордер. Возвращает positionId."""
    action = "ORDER_TYPE_BUY" if direction.lower() == "long" else "ORDER_TYPE_SELL"
    body: dict[str, Any] = {
        "actionType": action,
        "symbol": symbol,
        "volume": round(volume, 5),
    }
    if stop_loss is not None and stop_loss > 0:
        body["stopLoss"] = stop_loss
    if take_profit is not None and take_profit > 0:
        body["takeProfit"] = take_profit
    result = await _post(token, f"/users/current/accounts/{account_id}/trade", body)
    pos_id = result.get("positionId") or result.get("orderId")
    if not pos_id:
        raise RuntimeError("MetaAPI: positionId не получен в ответе")
    return str(pos_id)


async def close_mt_position(token: str, account_id: str, position_id: str) -> None:
    """Закрыть позицию по ID."""
    await _post(
        token,
        f"/users/current/accounts/{account_id}/trade",
        {"actionType": "POSITION_CLOSE_ID", "positionId": position_id},
    )


async def get_open_positions(token: str, account_id: str) -> list[dict[str, Any]]:
    """Список открытых позиций."""
    result = await _get(token, f"/users/current/accounts/{account_id}/positions")
    if isinstance(result, list):
        return result
    return result.get("positions") or []


def mt_symbol(bybit_symbol: str) -> str | None:
    """Маппинг Bybit → MT символ. BTCUSDT → BTCUSD. None если не поддерживается."""
    s = bybit_symbol.upper()
    if s.endswith("USDT"):
        return s[:-4] + "USD"
    if s.endswith("USD"):
        return s
    return None
