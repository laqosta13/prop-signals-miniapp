from __future__ import annotations

import base64
import binascii
from dataclasses import dataclass

import httpx

from app.config import settings


class TonPaymentError(ValueError):
    pass


@dataclass(frozen=True)
class TonPaymentCheck:
    tx_hash_hex: str
    confirmations: int
    amount_raw: int


def _hash_variants(tx_hash_hex: str) -> list[str]:
    raw = bytes.fromhex(tx_hash_hex)
    b64 = base64.b64encode(raw).decode("ascii")
    b64url = base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")
    return [tx_hash_hex, b64, b64url]


def _canon_hash(raw: str) -> str:
    token = raw.strip()
    if not token:
        raise TonPaymentError("TXID пустой")
    if token.startswith("0x"):
        token = token[2:]
    if len(token) == 64:
        try:
            int(token, 16)
            return token.lower()
        except ValueError:
            pass
    try:
        payload = base64.b64decode(token + "=" * ((4 - len(token) % 4) % 4), altchars=b"-_", validate=False)
        if len(payload) == 32:
            return payload.hex()
    except (binascii.Error, ValueError):
        pass
    raise TonPaymentError("Неверный TXID: нужен hash TON транзакции")


def _to_int(value: object) -> int:
    if value is None:
        return 0
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        try:
            return int(value)
        except ValueError:
            return 0
    return 0


def _headers() -> dict[str, str]:
    h: dict[str, str] = {}
    if settings.toncenter_api_key:
        h["X-API-Key"] = settings.toncenter_api_key
    return h


def _api_base() -> str:
    return settings.toncenter_api_base.rstrip("/")


def verify_usdt_ton_payment(tx_id: str, expected_usd: float) -> TonPaymentCheck:
    tx_hash = _canon_hash(tx_id)
    expected_raw = int(round(expected_usd * 1_000_000))
    if expected_raw <= 0:
        raise TonPaymentError("Некорректная сумма тарифа")

    timeout = settings.price_http_timeout_seconds
    headers = _headers()
    base = _api_base()
    transfer_url = (
        f"{base}/jetton/transfers"
        f"?owner_address={settings.usdt_ton_address}"
        f"&direction=in"
        f"&jetton_master={settings.usdt_ton_jetton_master}"
        "&limit=100"
        "&sort=desc"
    )
    with httpx.Client(timeout=timeout, headers=headers) as client:
        try:
            transfer_res = client.get(transfer_url)
            transfer_res.raise_for_status()
            payload = transfer_res.json()
        except Exception as e:
            raise TonPaymentError("Не удалось проверить оплату в TON сети, попробуйте позже") from e

        transfers = payload.get("jetton_transfers") or []
        selected: dict | None = None
        for row in transfers:
            try:
                row_hash = _canon_hash(str(row.get("transaction_hash", "")))
            except TonPaymentError:
                continue
            if row_hash == tx_hash:
                selected = row
                break
        if selected is None:
            raise TonPaymentError("TXID не найден среди входящих USDT переводов на наш кошелёк")
        if _to_int(selected.get("amount")) < expected_raw:
            raise TonPaymentError("Сумма в транзакции меньше стоимости выбранного тарифа")

        tx_rows: list[dict] = []
        for hash_candidate in _hash_variants(tx_hash):
            tx_res = client.get(f"{base}/transactions?hash={hash_candidate}&limit=1")
            tx_res.raise_for_status()
            tx_payload = tx_res.json()
            tx_rows = tx_payload.get("transactions") or []
            if tx_rows:
                break
        if not tx_rows:
            raise TonPaymentError("Не удалось получить данные транзакции")
        tx = tx_rows[0]
        tx_mc = _to_int(tx.get("mc_block_seqno"))
        if tx_mc <= 0:
            raise TonPaymentError("Транзакция ещё не финализирована в masterchain")

        mc_res = client.get(f"{base}/masterchainInfo")
        mc_res.raise_for_status()
        mc_payload = mc_res.json()
        latest_mc = _to_int((mc_payload.get("last") or {}).get("seqno"))
        if latest_mc <= 0:
            raise TonPaymentError("Не удалось определить число подтверждений")

    confirmations = max(0, latest_mc - tx_mc + 1)
    required = max(1, settings.ton_payment_min_confirmations)
    if confirmations < required:
        raise TonPaymentError(f"Недостаточно подтверждений: {confirmations}/{required}")

    return TonPaymentCheck(
        tx_hash_hex=tx_hash,
        confirmations=confirmations,
        amount_raw=_to_int(selected.get("amount") if selected else 0),
    )
