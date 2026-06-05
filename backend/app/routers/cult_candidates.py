"""API кандидатов CULT — пользователи со своими сигналами на Bybit."""

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.cult_candidate_service import (
    build_cult_candidate_me_read,
    build_cult_candidates_read,
    cult_candidate_account_size,
    ensure_can_trade,
    get_cult_candidate_signal,
    join_cult_candidate,
    update_display_name,
)
from app.cult_subscription_billing import (
    CULT_SUBSCRIPTION_DAYS,
    CULT_SUBSCRIPTION_USD,
    cult_subscription_active,
    record_cult_payment,
)
from app.deps import db_session, get_current_user
from app.trader_roster_service import cult_subscription_admin_bypass
from app.subscription_billing import ensure_payment_memo, usdt_pay_address
from app.models import Subscriber
from app.schemas import (
    CultCandidateJoinBody,
    CultCandidateMeRead,
    CultCandidatePatchBody,
    CultCandidatePayBody,
    CultCandidateRead,
    CultCandidateSubscriptionInfo,
    SignalRead,
    TelegramUser,
)
from app.serializers import signal_to_read
from app.signal_service import build_signal_row, stamp_signal_at_publication
from app.routers.signals import _parse_direction

router = APIRouter(prefix="/cult-candidates", tags=["cult-candidates"])


def _subscriber(db: Session, user: TelegramUser) -> Subscriber:
    sub = db.get(Subscriber, user.telegram_user_id)
    if sub is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="not_registered")
    return sub


@router.get("", response_model=list[CultCandidateRead])
def list_cult_candidates(
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(get_current_user),
) -> list[CultCandidateRead]:
    return build_cult_candidates_read(db, viewer_id=user.telegram_user_id)


@router.get("/subscription/info", response_model=CultCandidateSubscriptionInfo)
def cult_subscription_info(
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(get_current_user),
) -> CultCandidateSubscriptionInfo:
    sub = _subscriber(db, user)
    return CultCandidateSubscriptionInfo(
        usdt_ton_address=usdt_pay_address(),
        payment_memo=ensure_payment_memo(db, sub),
        subscription_usd=CULT_SUBSCRIPTION_USD,
        subscription_days=CULT_SUBSCRIPTION_DAYS,
        cult_subscription_until=sub.cult_subscription_until,
        cult_subscription_active=cult_subscription_active(
            sub, is_admin=cult_subscription_admin_bypass(db, user.telegram_user_id)
        ),
    )


@router.post("/subscription/pay", response_model=CultCandidateSubscriptionInfo)
def cult_subscription_pay(
    body: CultCandidatePayBody,
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(get_current_user),
) -> CultCandidateSubscriptionInfo:
    sub = _subscriber(db, user)
    try:
        record_cult_payment(db, user.telegram_user_id, body.tx_id)
        db.commit()
        db.refresh(sub)
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    return CultCandidateSubscriptionInfo(
        usdt_ton_address=usdt_pay_address(),
        payment_memo=ensure_payment_memo(db, sub),
        subscription_usd=CULT_SUBSCRIPTION_USD,
        subscription_days=CULT_SUBSCRIPTION_DAYS,
        cult_subscription_until=sub.cult_subscription_until,
        cult_subscription_active=cult_subscription_active(
            sub, is_admin=cult_subscription_admin_bypass(db, user.telegram_user_id)
        ),
    )


@router.get("/signals/{signal_id}", response_model=SignalRead)
def cult_candidate_signal_detail(
    signal_id: int,
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(get_current_user),
) -> SignalRead:
    try:
        row = get_cult_candidate_signal(db, signal_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
    return signal_to_read(db, row, user.telegram_user_id)


@router.get("/me", response_model=CultCandidateMeRead)
def cult_candidate_me(
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(get_current_user),
) -> CultCandidateMeRead:
    return build_cult_candidate_me_read(db, _subscriber(db, user))


@router.post("/me", response_model=CultCandidateRead, status_code=status.HTTP_201_CREATED)
def become_cult_candidate(
    body: CultCandidateJoinBody,
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(get_current_user),
) -> CultCandidateRead:
    sub = _subscriber(db, user)
    try:
        join_cult_candidate(
            db,
            sub,
            cult_admin_bypass=cult_subscription_admin_bypass(db, user.telegram_user_id),
            user=user,
            display_name=body.display_name,
        )
        db.commit()
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    rows = build_cult_candidates_read(db, viewer_id=user.telegram_user_id)
    found = next((r for r in rows if r.telegram_user_id == user.telegram_user_id), None)
    if found is None:
        raise HTTPException(status_code=500, detail="candidate_created_but_unreadable")
    return found


@router.patch("/me", response_model=CultCandidateRead)
def patch_cult_candidate_me(
    body: CultCandidatePatchBody,
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(get_current_user),
) -> CultCandidateRead:
    try:
        update_display_name(db, user.telegram_user_id, body.display_name)
        db.commit()
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    rows = build_cult_candidates_read(db, viewer_id=user.telegram_user_id)
    found = next((r for r in rows if r.telegram_user_id == user.telegram_user_id), None)
    if found is None:
        raise HTTPException(status_code=404, detail="candidate_not_found")
    return found


@router.post("/me/signals", response_model=SignalRead)
async def create_cult_candidate_signal(
    symbol: str = Form(...),
    direction: str = Form(...),
    entry_low: str | None = Form(None),
    entry_high: str | None = Form(None),
    stop_loss: str | None = Form(None),
    take_profits: str | None = Form(None),
    comment: str | None = Form(None),
    leverage: int | None = Form(None),
    risk_percent: float | None = Form(None),
    db: Session = Depends(db_session),
    user: TelegramUser = Depends(get_current_user),
) -> SignalRead:
    sub = _subscriber(db, user)
    try:
        ensure_can_trade(db, sub)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e)) from e

    acct = cult_candidate_account_size(db, user.telegram_user_id)
    stake = risk_percent if risk_percent is not None and risk_percent > 0 else 10.0
    lev = leverage if leverage is not None and leverage >= 1 else 1
    row = build_signal_row(
        db,
        symbol=symbol.strip().upper(),
        direction=_parse_direction(direction),
        entry_low=entry_low or None,
        entry_high=entry_high or None,
        stop_loss=stop_loss or None,
        take_profits=take_profits or None,
        comment=comment or None,
        author_telegram_id=user.telegram_user_id,
        author_username=user.username,
        author_first_name=user.first_name,
        author_last_name=user.last_name,
        leverage=min(int(lev), 5),
        risk_percent=stake,
        tracker_balance=acct,
        account_size=acct,
        is_cult_candidate=True,
    )
    db.add(row)
    db.flush()
    await stamp_signal_at_publication(db, row, notify_entry=False)
    db.commit()
    db.refresh(row)
    return signal_to_read(db, row, user.telegram_user_id)
