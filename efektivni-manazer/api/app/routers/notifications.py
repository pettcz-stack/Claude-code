from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import require_session
from ..db import get_db
from ..models import Notification
from ..schemas import NotificationOut

router = APIRouter(prefix="/notifications", tags=["notifications"], dependencies=[Depends(require_session)])


@router.get("", response_model=list[NotificationOut])
def list_notifications(
    open_only: bool = Query(True),
    db: Session = Depends(get_db),
) -> list[Notification]:
    now = datetime.now(timezone.utc)
    stmt = select(Notification).order_by(Notification.created_at.desc()).limit(500)
    if open_only:
        stmt = stmt.where(Notification.dismissed_at.is_(None))
    rows = list(db.execute(stmt).scalars())
    if open_only:
        rows = [n for n in rows if n.snoozed_until is None or n.snoozed_until <= now]
    return rows


@router.post("/{notification_id}/dismiss")
def dismiss(notification_id: int, db: Session = Depends(get_db)) -> dict[str, bool]:
    n = db.get(Notification, notification_id)
    if n is None:
        raise HTTPException(404, "Notifikace neexistuje")
    n.dismissed_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True}


@router.post("/{notification_id}/snooze")
def snooze(notification_id: int, hours: int = Query(4, ge=1, le=24 * 14), db: Session = Depends(get_db)) -> dict[str, bool]:
    n = db.get(Notification, notification_id)
    if n is None:
        raise HTTPException(404, "Notifikace neexistuje")
    n.snoozed_until = datetime.now(timezone.utc) + timedelta(hours=hours)
    db.commit()
    return {"ok": True}
