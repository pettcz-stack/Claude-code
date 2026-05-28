import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Message, Setting, Task, TaskDirection, TaskPhase, Thread
from .crypto import decrypt
from .llm import extract_from_thread
from .mail.imap_provider import ImapMailProvider
from .mail.provider import FetchedMessage

logger = logging.getLogger(__name__)


def _profile(db: Session) -> tuple[str, list[str], str]:
    row = db.get(Setting, "profile")
    if row is None:
        return "", [], ""
    v = row.value
    return v.get("my_email", "").lower(), [a.lower() for a in v.get("my_aliases", [])], v.get("my_name", "")


def _imap_config(db: Session) -> dict | None:
    row = db.get(Setting, "mail.imap")
    if row is None or not row.value.get("password_enc"):
        return None
    v = dict(row.value)
    v["password"] = decrypt(v.pop("password_enc"))
    return v


def _direction_for(msg: FetchedMessage, my_email: str, my_aliases: list[str]) -> str:
    me = {my_email, *my_aliases}
    return "outbound" if (msg.from_addr or "").lower() in me else "inbound"


def _participants(msgs: list[Message]) -> list[str]:
    s: set[str] = set()
    for m in msgs:
        if m.from_addr:
            s.add(m.from_addr.lower())
        for a in (m.to_addrs or []) + (m.cc_addrs or []):
            if a:
                s.add(a.lower())
    return sorted(s)


def _thread_key(subject: str) -> str:
    """Velmi jednoduché grouping: subject bez Re:/Fwd: a whitespace."""
    s = (subject or "").strip()
    for prefix in ("Re:", "RE:", "Fw:", "FW:", "Fwd:", "FWD:", "Odp.:", "Odp:"):
        while s.startswith(prefix):
            s = s[len(prefix):].strip()
    return s.lower()


def _find_or_create_thread(db: Session, fetched: FetchedMessage) -> Thread:
    # 1) podle In-Reply-To / References
    if fetched.in_reply_to:
        existing = db.execute(
            select(Message).where(Message.message_id_hdr == fetched.in_reply_to)
        ).scalar_one_or_none()
        if existing:
            return db.get(Thread, existing.thread_id)
    for ref in fetched.references:
        existing = db.execute(
            select(Message).where(Message.message_id_hdr == ref)
        ).scalar_one_or_none()
        if existing:
            return db.get(Thread, existing.thread_id)

    # 2) heuristika podle normalizovaného subjectu (poslední 14 dní)
    norm = _thread_key(fetched.subject)
    if norm:
        cutoff = datetime.now(timezone.utc) - timedelta(days=14)
        cand = db.execute(
            select(Thread).where(Thread.last_message_at >= cutoff)
        ).scalars()
        for t in cand:
            if _thread_key(t.subject) == norm:
                return t

    # 3) nové vlákno
    t = Thread(subject=fetched.subject, participants=[], last_message_at=fetched.date)
    db.add(t)
    db.flush()
    return t


def sync_mailbox(db: Session, lookback_days: int = 14) -> dict[str, int]:
    """Stáhne nové emaily z IMAP do DB. Pak postupně volá extractor."""
    cfg = _imap_config(db)
    if cfg is None:
        logger.info("IMAP credentials nejsou nastaveny – sync přeskakuji")
        return {"fetched": 0, "new_messages": 0, "new_tasks": 0, "updated_tasks": 0}

    my_email, my_aliases, my_name = _profile(db)
    if not my_email:
        logger.warning("Profile.my_email není nastaven – přiřazení směru bude nepřesné")

    provider = ImapMailProvider(
        host=cfg["host"], port=cfg["port"], use_ssl=cfg["use_ssl"],
        username=cfg["username"], password=cfg["password"],
    )

    since = datetime.now(timezone.utc) - timedelta(days=lookback_days)
    fetched_all: list[FetchedMessage] = []
    for folder in (cfg["inbox_folder"], cfg["sent_folder"]):
        try:
            fetched_all += provider.fetch_since(folder, since)
        except Exception as e:
            logger.exception("IMAP fetch selhal pro %s: %s", folder, e)

    new_messages = 0
    affected_threads: set[int] = set()
    for fm in fetched_all:
        if not fm.message_id:
            continue
        # už existuje?
        existing = db.execute(
            select(Message).where(Message.message_id_hdr == fm.message_id)
        ).scalar_one_or_none()
        if existing:
            continue

        thread = _find_or_create_thread(db, fm)
        m = Message(
            thread_id=thread.id,
            message_id_hdr=fm.message_id,
            in_reply_to=fm.in_reply_to,
            folder=fm.folder,
            direction=_direction_for(fm, my_email, my_aliases),
            from_addr=fm.from_addr,
            to_addrs=fm.to_addrs,
            cc_addrs=fm.cc_addrs,
            subject=fm.subject,
            date=fm.date,
            body_text=fm.body_text,
            body_html=fm.body_html,
            raw_headers=fm.raw_headers,
        )
        db.add(m)
        thread.last_message_at = max(thread.last_message_at or fm.date, fm.date)
        affected_threads.add(thread.id)
        new_messages += 1
    db.commit()

    new_tasks = 0
    updated_tasks = 0
    for tid in affected_threads:
        thread = db.get(Thread, tid)
        if thread is None or thread.is_ignored:
            continue
        thread.participants = _participants(thread.messages)
        created, updated = _extract_and_persist(db, thread, my_email, my_aliases, my_name)
        new_tasks += created
        updated_tasks += updated
        db.commit()

    return {
        "fetched": len(fetched_all),
        "new_messages": new_messages,
        "new_tasks": new_tasks,
        "updated_tasks": updated_tasks,
    }


def _extract_and_persist(
    db: Session, thread: Thread, my_email: str, my_aliases: list[str], my_name: str,
) -> tuple[int, int]:
    """Zavolá LLM nad celým vláknem a vytvoří/updatne úkol."""
    msgs = sorted(thread.messages, key=lambda m: m.date)
    payload = [
        {
            "direction": m.direction,
            "from": m.from_addr,
            "to": m.to_addrs,
            "cc": m.cc_addrs,
            "date": m.date.isoformat(),
            "subject": m.subject,
            "body_text": (m.body_text or "")[:8000],
        }
        for m in msgs
    ]

    try:
        result = extract_from_thread(thread.subject, payload, my_email, my_aliases, my_name)
    except Exception as e:
        logger.exception("LLM extraction selhala: %s", e)
        return (0, 0)

    if not result.is_task or result.direction not in ("delegated", "mine"):
        return (0, 0)

    direction = TaskDirection(result.direction)
    existing = next((t for t in thread.tasks if t.direction == direction), None)

    # manuální overrides nepřepisujeme (kromě last_activity_at)
    if existing is None:
        try:
            phase = TaskPhase(result.phase) if result.phase else TaskPhase.new
        except ValueError:
            phase = TaskPhase.new
        t = Task(
            thread_id=thread.id,
            direction=direction,
            phase=phase,
            counterpart_email=result.counterpart_email,
            counterpart_name=result.counterpart_name,
            title=result.title or thread.subject[:200],
            summary=result.summary,
            requested_output=result.requested_output,
            deadline=result.deadline,
            last_activity_at=thread.last_message_at or datetime.now(timezone.utc),
            extractor_meta={"confidence": result.confidence, "model_raw": result.raw},
        )
        db.add(t)
        return (1, 0)

    overrides = existing.manual_overrides or {}
    if "phase" not in overrides and result.phase:
        try:
            existing.phase = TaskPhase(result.phase)
        except ValueError:
            pass
    if "title" not in overrides and result.title:
        existing.title = result.title
    if "summary" not in overrides and result.summary:
        existing.summary = result.summary
    if "deadline" not in overrides and result.deadline:
        existing.deadline = result.deadline
    if result.requested_output:
        existing.requested_output = result.requested_output
    if result.counterpart_email:
        existing.counterpart_email = result.counterpart_email
    if result.counterpart_name:
        existing.counterpart_name = result.counterpart_name
    existing.last_activity_at = thread.last_message_at or datetime.now(timezone.utc)
    existing.extractor_meta = {"confidence": result.confidence, "model_raw": result.raw}
    return (0, 1)
