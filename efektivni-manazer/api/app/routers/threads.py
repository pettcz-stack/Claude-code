from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..auth import require_session
from ..db import get_db
from ..models import Message, Thread
from ..schemas import ThreadDetail, ThreadOut

router = APIRouter(prefix="/threads", tags=["threads"], dependencies=[Depends(require_session)])


@router.get("", response_model=list[ThreadOut])
def list_threads(db: Session = Depends(get_db)) -> list[Thread]:
    stmt = select(Thread).order_by(Thread.last_message_at.desc()).limit(200)
    return list(db.execute(stmt).scalars())


@router.get("/{thread_id}", response_model=ThreadDetail)
def get_thread(thread_id: int, db: Session = Depends(get_db)) -> Thread:
    stmt = (
        select(Thread)
        .where(Thread.id == thread_id)
        .options(selectinload(Thread.messages), selectinload(Thread.tasks))
    )
    t = db.execute(stmt).scalar_one_or_none()
    if t is None:
        raise HTTPException(404, "Vlákno neexistuje")
    t.messages.sort(key=lambda m: m.date)
    return t
