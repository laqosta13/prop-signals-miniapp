"""Детектор внебиржевых сделок: позиции на Bybit без сигнала в приложении → лейба 'лудка'."""

from __future__ import annotations

import asyncio
import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.bybit_trading import BybitCredentials, get_all_open_positions
from app.copy_trading_service import _user_credentials
from app.models import CultCandidate, Signal, UserBybitSettings

logger = logging.getLogger(__name__)

_CHECK_INTERVAL = 300  # 5 минут


async def _check_candidate(db: Session, row: CultCandidate) -> None:
    bybit = db.get(UserBybitSettings, row.telegram_user_id)
    if bybit is None:
        return

    try:
        creds: BybitCredentials = _user_credentials(bybit)
        positions = await get_all_open_positions(creds)
    except Exception as e:
        logger.debug("outside_trade check failed for %s: %s", row.telegram_user_id, e)
        return

    app_positions = {
        (str(s.symbol).upper(), str(s.direction).lower())
        for s in db.scalars(
            select(Signal).where(
                Signal.author_telegram_id == row.telegram_user_id,
                Signal.status == "active",
                Signal.is_cult_candidate.is_(True),
            )
        ).all()
    }

    outside = any(
        (sym.upper(), direction.lower()) not in app_positions
        for sym, direction in positions
    )

    if bool(row.outside_trade) != outside:
        row.outside_trade = outside
        db.commit()


async def outside_trade_detector_loop() -> None:
    from app.database import SessionLocal
    from app.models import CultCandidate

    logger.info("Outside trade detector started (interval=%ss)", _CHECK_INTERVAL)
    while True:
        await asyncio.sleep(_CHECK_INTERVAL)
        try:
            with SessionLocal() as db:
                candidates = list(db.scalars(select(CultCandidate).where(CultCandidate.enabled.is_(True))).all())
            for row in candidates:
                with SessionLocal() as db:
                    row = db.get(CultCandidate, row.telegram_user_id)
                    if row:
                        await _check_candidate(db, row)
        except Exception:
            logger.exception("outside_trade_detector_loop error")
