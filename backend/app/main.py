import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles

from app import models  # noqa: F401
from app.config import settings
from app.media_storage import media_root
from app.database import Base, engine
from app.migrate import run_migrations
from app.price_monitor import price_monitor_loop
from app.copy_billing_scheduler import copy_billing_scheduler_loop
from app.rank_scheduler import rank_scheduler_loop
from app.subscription_pause_scheduler import run_subscription_pause_sync, subscription_pause_scheduler_loop
from app.support_chat import verify_support_group_after_delay
from app.telegram_updates import telegram_updates_loop
from app.routers import (
    admin,
    auth,
    challenge,
    copy_trading,
    cult_candidates,
    cult_channels,
    news,
    reviews,
    signals,
    subscriptions,
    support,
    traders,
)

logging.basicConfig(level=logging.INFO)
# httpx/httpcore логируют полные URL (в т.ч. BOT_TOKEN в api.telegram.org) — только ошибки.
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

Base.metadata.create_all(bind=engine)
run_migrations(engine)
media_root()


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.price_monitor import check_active_signals_once

    await check_active_signals_once()
    asyncio.create_task(verify_support_group_after_delay())
    try:
        run_subscription_pause_sync()
    except Exception:
        logging.getLogger(__name__).exception("subscription pause startup run failed")
    price_task = asyncio.create_task(price_monitor_loop())
    rank_task = asyncio.create_task(rank_scheduler_loop())
    billing_task = asyncio.create_task(copy_billing_scheduler_loop())
    pause_task = asyncio.create_task(subscription_pause_scheduler_loop())
    tg_task = asyncio.create_task(telegram_updates_loop())
    yield
    for task in (price_task, rank_task, billing_task, pause_task, tg_task):
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


app = FastAPI(title="Prop Signals API", version="0.2.0", lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=800)

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(copy_trading.router)
app.include_router(cult_channels.router)
app.include_router(cult_candidates.router)
app.include_router(admin.router)
app.include_router(auth.router)
app.include_router(challenge.router)
app.include_router(signals.router)
app.include_router(traders.router)
app.include_router(subscriptions.router)
app.include_router(support.router)
app.include_router(reviews.router)
app.include_router(news.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


_media = Path(settings.media_root)
if _media.is_dir():
    app.mount("/media", StaticFiles(directory=str(_media)), name="media")

_static = os.environ.get("STATIC_ROOT", "").strip()
if _static and Path(_static).is_dir():
    app.mount("/", StaticFiles(directory=_static, html=True), name="spa")
