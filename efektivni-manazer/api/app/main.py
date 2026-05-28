from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .auth import ensure_master_password
from .db import Base, SessionLocal, engine
from . import models  # noqa: F401  (registrace modelů do Base)
from .routers import auth, notifications, rules, settings_router, stats, tasks, threads
from .services.sla import ensure_default_rules


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        ensure_master_password(db)
        ensure_default_rules(db)
    yield


app = FastAPI(title="Efektivní manažer API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8090", "http://127.0.0.1:8090"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(tasks.router)
app.include_router(threads.router)
app.include_router(rules.router)
app.include_router(notifications.router)
app.include_router(settings_router.router)
app.include_router(stats.router)


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}
