import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..auth import require_session
from ..db import get_db
from ..models import Task, Thread
from ..services.llm import draft_ping, summarize_thread

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai", tags=["ai"], dependencies=[Depends(require_session)])


class DraftPingRequest(BaseModel):
    tone: str = "friendly"  # friendly | formal | urgent


class TextResponse(BaseModel):
    text: str


@router.post("/tasks/{task_id}/draft-ping", response_model=TextResponse)
def post_draft_ping(task_id: int, payload: DraftPingRequest, db: Session = Depends(get_db)) -> TextResponse:
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(404, "Úkol neexistuje")
    thread = db.execute(
        select(Thread).where(Thread.id == task.thread_id).options(selectinload(Thread.messages))
    ).scalar_one_or_none()
    messages = []
    if thread:
        messages = [
            {
                "direction": m.direction,
                "from": m.from_addr,
                "to": m.to_addrs,
                "date": m.date.isoformat(),
                "body_text": (m.body_text or "")[:3000],
            }
            for m in sorted(thread.messages, key=lambda m: m.date)[-5:]
        ]
    try:
        text = draft_ping(
            task_title=task.title,
            task_summary=task.summary,
            counterpart_name=task.counterpart_name or task.counterpart_email,
            last_messages=messages,
            tone=payload.tone,
        )
    except Exception as e:
        logger.exception("draft_ping selhal: %s", e)
        raise HTTPException(502, f"LLM selhal: {e}") from e
    return TextResponse(text=text)


@router.post("/threads/{thread_id}/summarize", response_model=TextResponse)
def post_summarize_thread(thread_id: int, db: Session = Depends(get_db)) -> TextResponse:
    thread = db.execute(
        select(Thread).where(Thread.id == thread_id).options(selectinload(Thread.messages))
    ).scalar_one_or_none()
    if thread is None:
        raise HTTPException(404, "Vlákno neexistuje")
    if not thread.messages:
        return TextResponse(text="*Vlákno nemá žádné zprávy k sumarizaci.*")
    messages = [
        {
            "direction": m.direction,
            "from": m.from_addr,
            "to": m.to_addrs,
            "date": m.date.isoformat(),
            "subject": m.subject,
            "body_text": (m.body_text or "")[:4000],
        }
        for m in sorted(thread.messages, key=lambda m: m.date)
    ]
    try:
        text = summarize_thread(thread.subject, messages)
    except Exception as e:
        logger.exception("summarize selhal: %s", e)
        raise HTTPException(502, f"LLM selhal: {e}") from e
    return TextResponse(text=text)
