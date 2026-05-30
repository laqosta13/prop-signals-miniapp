"""Bybit v5 Trading API — ордера USDT perpetual (linear)."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import math
import time
from dataclasses import dataclass
from decimal import Decimal, ROUND_DOWN
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_RECV_WINDOW = "5000"
_INSTRUMENT_CACHE: dict[str, dict[str, float | str]] = {}
_httpx_client: httpx.AsyncClient | None = None


@dataclass(frozen=True)
class BybitCredentials:
    api_key: str
    api_secret: str
    testnet: bool = True

    @property
    def api_base(self) -> str:
        if self.testnet:
            return "https://api-testnet.bybit.com"
        return "https://api.bybit.com"


@dataclass(frozen=True)
class InstrumentRules:
    qty_step: Decimal
    min_qty: Decimal
    tick_size: Decimal


def _client() -> httpx.AsyncClient:
    global _httpx_client
    if _httpx_client is None or _httpx_client.is_closed:
        _httpx_client = httpx.AsyncClient(timeout=settings.price_http_timeout_seconds)
    return _httpx_client


def _sign(creds: BybitCredentials, payload: str) -> str:
    return hmac.new(
        creds.api_secret.encode(),
        payload.encode(),
        hashlib.sha256,
    ).hexdigest()


def _auth_headers(creds: BybitCredentials, payload: str) -> dict[str, str]:
    ts = str(int(time.time() * 1000))
    prehash = ts + creds.api_key + _RECV_WINDOW + payload
    return {
        "X-BAPI-API-KEY": creds.api_key,
        "X-BAPI-SIGN": _sign(creds, prehash),
        "X-BAPI-TIMESTAMP": ts,
        "X-BAPI-RECV-WINDOW": _RECV_WINDOW,
        "Content-Type": "application/json",
    }


def _parse_decimal(raw: str | float | int | None, default: str = "0") -> Decimal:
    if raw is None:
        return Decimal(default)
    return Decimal(str(raw))


def _floor_to_step(value: Decimal, step: Decimal) -> Decimal:
    if step <= 0:
        return value
    units = (value / step).to_integral_value(rounding=ROUND_DOWN)
    return units * step


def _fmt_decimal(value: Decimal) -> str:
    text = format(value.normalize(), "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text or "0"


async def _request(
    creds: BybitCredentials,
    method: str,
    path: str,
    *,
    params: dict[str, Any] | None = None,
    body: dict[str, Any] | None = None,
) -> dict[str, Any]:
    url = f"{creds.api_base}{path}"
    if method == "GET":
        query = "&".join(f"{k}={v}" for k, v in (params or {}).items())
        headers = _auth_headers(creds, query)
        r = await _client().get(url, params=params, headers=headers)
    else:
        payload = json.dumps(body or {}, separators=(",", ":"))
        headers = _auth_headers(creds, payload)
        r = await _client().post(url, content=payload, headers=headers)
    data = r.json()
    if r.status_code != 200 or data.get("retCode") != 0:
        msg = data.get("retMsg") or f"HTTP {r.status_code}"
        raise RuntimeError(f"Bybit {path}: {msg}")
    return data.get("result") or {}


async def get_instrument_rules(creds: BybitCredentials, pair: str) -> InstrumentRules:
    cache_key = f"{creds.api_base}:{pair}"
    cached = _INSTRUMENT_CACHE.get(cache_key)
    if cached:
        return InstrumentRules(
            qty_step=_parse_decimal(cached["qty_step"]),
            min_qty=_parse_decimal(cached["min_qty"]),
            tick_size=_parse_decimal(cached["tick_size"]),
        )
    r = await _client().get(
        f"{creds.api_base}/v5/market/instruments-info",
        params={"category": "linear", "symbol": pair},
    )
    data = r.json()
    if r.status_code != 200 or data.get("retCode") != 0:
        raise RuntimeError(f"Bybit instruments-info: {data.get('retMsg') or r.status_code}")
    items = (data.get("result") or {}).get("list") or []
    if not items:
        raise RuntimeError(f"Bybit: пара {pair} не найдена")
    lot = items[0].get("lotSizeFilter") or {}
    price = items[0].get("priceFilter") or {}
    rules = InstrumentRules(
        qty_step=_parse_decimal(lot.get("qtyStep"), "0.001"),
        min_qty=_parse_decimal(lot.get("minOrderQty"), "0.001"),
        tick_size=_parse_decimal(price.get("tickSize"), "0.01"),
    )
    _INSTRUMENT_CACHE[cache_key] = {
        "qty_step": str(rules.qty_step),
        "min_qty": str(rules.min_qty),
        "tick_size": str(rules.tick_size),
    }
    return rules


def calc_qty(notional_usd: float, price: float, rules: InstrumentRules) -> Decimal | None:
    if notional_usd <= 0 or price <= 0 or not math.isfinite(notional_usd) or not math.isfinite(price):
        return None
    raw = Decimal(str(notional_usd)) / Decimal(str(price))
    qty = _floor_to_step(raw, rules.qty_step)
    if qty < rules.min_qty:
        return None
    return qty


async def set_leverage(creds: BybitCredentials, pair: str, leverage: int) -> None:
    lev = max(1, min(int(leverage), 100))
    try:
        await _request(
            creds,
            "POST",
            "/v5/position/set-leverage",
            body={
                "category": "linear",
                "symbol": pair,
                "buyLeverage": str(lev),
                "sellLeverage": str(lev),
            },
        )
    except RuntimeError as e:
        if "110043" not in str(e) and "leverage not modified" not in str(e).lower():
            raise


async def place_market_entry(
    creds: BybitCredentials,
    *,
    pair: str,
    side: str,
    qty: Decimal,
    order_link_id: str,
) -> str:
    result = await _request(
        creds,
        "POST",
        "/v5/order/create",
        body={
            "category": "linear",
            "symbol": pair,
            "side": side,
            "orderType": "Market",
            "qty": _fmt_decimal(qty),
            "orderLinkId": order_link_id,
            "positionIdx": 0,
        },
    )
    order_id = result.get("orderId")
    if not order_id:
        raise RuntimeError("Bybit: orderId не получен")
    return str(order_id)


async def set_position_stops(
    creds: BybitCredentials,
    *,
    pair: str,
    stop_loss: float | None,
    take_profit: float | None,
) -> None:
    body: dict[str, Any] = {
        "category": "linear",
        "symbol": pair,
        "positionIdx": 0,
        "tpslMode": "Full",
        "tpTriggerBy": "LastPrice",
        "slTriggerBy": "LastPrice",
    }
    if stop_loss is not None and stop_loss > 0:
        body["stopLoss"] = str(stop_loss)
    if take_profit is not None and take_profit > 0:
        body["takeProfit"] = str(take_profit)
    if "stopLoss" not in body and "takeProfit" not in body:
        return
    await _request(creds, "POST", "/v5/position/trading-stop", body=body)


async def close_position_market(
    creds: BybitCredentials,
    *,
    pair: str,
    side: str,
    qty: Decimal,
    order_link_id: str,
) -> str:
    result = await _request(
        creds,
        "POST",
        "/v5/order/create",
        body={
            "category": "linear",
            "symbol": pair,
            "side": side,
            "orderType": "Market",
            "qty": _fmt_decimal(qty),
            "reduceOnly": True,
            "orderLinkId": order_link_id,
            "positionIdx": 0,
        },
    )
    order_id = result.get("orderId")
    if not order_id:
        raise RuntimeError("Bybit: close orderId не получен")
    return str(order_id)


async def get_wallet_usdt_balance(creds: BybitCredentials) -> float | None:
    result = await _request(
        creds,
        "GET",
        "/v5/account/wallet-balance",
        params={"accountType": "UNIFIED"},
    )
    for acct in result.get("list") or []:
        for coin in acct.get("coin") or []:
            if coin.get("coin") == "USDT":
                raw = coin.get("walletBalance") or coin.get("equity")
                if raw is not None:
                    return float(raw)
    return None
