from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import require_session
from ..db import get_db
from ..models import Task, TaskPhase
from ..schemas import TaskOut, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["tasks"], dependencies=[Depends(require_session)])


@router.get("", response_model=list[TaskOut])
def list_tasks(
    direction: str | None = Query(None),
    phase: str | None = Query(None),
    open_only: bool = Query(True),
    db: Session = Depends(get_db),
) -> list[Task]:
    stmt = select(Task).order_by(Task.last_activity_at.desc())
    if direction:
        stmt = stmt.where(Task.direction == direction)
    if phase:
        stmt = stmt.where(Task.phase == phase)
    if open_only:
        stmt = stmt.where(Task.closed_at.is_(None))
    return list(db.execute(stmt).scalars())


@router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: int, db: Session = Depends(get_db)) -> Task:
    t = db.get(Task, task_id)
    if t is None:
        raise HTTPException(404, "Úkol neexistuje")
    return t


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(task_id: int, payload: TaskUpdate, db: Session = Depends(get_db)) -> Task:
    t = db.get(Task, task_id)
    if t is None:
        raise HTTPException(404, "Úkol neexistuje")
    overrides = dict(t.manual_overrides or {})
    if payload.phase is not None:
        try:
            t.phase = TaskPhase(payload.phase)
        except ValueError as e:
            raise HTTPException(400, "Neznámá fáze") from e
        overrides["phase"] = payload.phase
    if payload.title is not None:
        t.title = payload.title
        overrides["title"] = payload.title
    if payload.summary is not None:
        t.summary = payload.summary
        overrides["summary"] = payload.summary
    if payload.deadline is not None:
        t.deadline = payload.deadline
        overrides["deadline"] = payload.deadline.isoformat()
    if payload.snoozed_until is not None:
        t.snoozed_until = payload.snoozed_until
    if payload.closed is True:
        t.closed_at = datetime.now(timezone.utc)
        t.phase = TaskPhase.done
    elif payload.closed is False:
        t.closed_at = None
    t.manual_overrides = overrides
    db.commit()
    db.refresh(t)
    return t
