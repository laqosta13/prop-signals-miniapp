import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app import models  # noqa: F401
from app.config import settings
from app.media_storage import media_root
from app.database import Base, engine
from app.migrate import run_migrations
from app.price_monitor import price_monitor_loop
from app.routers import auth, challenge, news, reviews, signals, subscriptions, traders

logging.basicConfig(level=logging.INFO)

Base.metadata.create_all(bind=engine)
run_migrations(engine)
media_root()


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.price_monitor import check_active_signals_once

    await check_active_signals_once()
    task = asyncio.create_task(price_monitor_loop())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="Prop Signals API", version="0.2.0", lifespan=lifespan)

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(challenge.router)
app.include_router(signals.router)
app.include_router(traders.router)
app.include_router(subscriptions.router)
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
