from datetime import datetime, timezone
from collections import defaultdict
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import require_session
from ..db import get_db
from ..models import Task, TaskDirection, TaskPhase

router = APIRouter(prefix="/stats", tags=["stats"], dependencies=[Depends(require_session)])


@router.get("/overview")
def overview(db: Session = Depends(get_db)) -> dict:
    now = datetime.now(timezone.utc)
    tasks = list(db.execute(select(Task).where(Task.closed_at.is_(None))).scalars())

    overdue = sum(1 for t in tasks if t.deadline and t.deadline < now)
    awaiting_ack = sum(1 for t in tasks if t.phase == TaskPhase.awaiting_ack)
    awaiting_eta = sum(1 for t in tasks if t.phase == TaskPhase.awaiting_eta)
    mine_open = sum(1 for t in tasks if t.direction == TaskDirection.mine)
    delegated_open = sum(1 for t in tasks if t.direction == TaskDirection.delegated)

    return {
        "open": len(tasks),
        "overdue": overdue,
        "awaiting_ack": awaiting_ack,
        "awaiting_eta": awaiting_eta,
        "mine_open": mine_open,
        "delegated_open": delegated_open,
    }


@router.get("/counterparts")
def counterparts(db: Session = Depends(get_db)) -> list[dict]:
    """Per-osoba breakdown: kolik mi dluží, kolik dlužím já, kolik dokončeno."""
    now = datetime.now(timezone.utc)
    tasks = list(db.execute(select(Task)).scalars())

    by_email: dict[str, dict] = defaultdict(lambda: {
        "email": "", "name": "",
        "owes_me": 0, "i_owe": 0, "done": 0,
        "overdue": 0, "last_activity": None,
    })

    for t in tasks:
        email = (t.counterpart_email or "").lower() or "(neznámý)"
        agg = by_email[email]
        agg["email"] = email
        if not agg["name"] and t.counterpart_name:
            agg["name"] = t.counterpart_name
        if t.closed_at:
            agg["done"] += 1
        else:
            if t.direction == TaskDirection.delegated:
                agg["owes_me"] += 1
            else:
                agg["i_owe"] += 1
            if t.deadline and t.deadline < now:
                agg["overdue"] += 1
        if agg["last_activity"] is None or t.last_activity_at > agg["last_activity"]:
            agg["last_activity"] = t.last_activity_at

    out = list(by_email.values())
    # serializovat datetime
    for a in out:
        if a["last_activity"]:
            a["last_activity"] = a["last_activity"].isoformat()
    out.sort(key=lambda x: x["owes_me"] + x["i_owe"], reverse=True)
    return out
