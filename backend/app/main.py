import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app import models  # noqa: F401 — регистрация таблиц для metadata.create_all
from app.config import settings
from app.database import Base, engine
from app.routers import auth, signals

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Prop Signals API", version="0.1.0")

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(signals.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


_static = os.environ.get("STATIC_ROOT", "").strip()
if _static and Path(_static).is_dir():
    app.mount("/", StaticFiles(directory=_static, html=True), name="spa")
