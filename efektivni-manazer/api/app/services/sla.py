import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Notification, NotificationLevel, Rule, Task, TaskPhase

logger = logging.getLogger(__name__)

DEFAULT_RULES = [
    {
        "name": "Delegovaný úkol – nepotvrzeno přijetí > 24 h",
        "description": "Druhá strana po 24 h nepotvrdila ani neodpověděla.",
        "condition": {"direction": "delegated", "phases": ["new", "awaiting_ack"], "hours_since_activity_gte": 24},
        "action": {"level": "warning", "message": "Pingnout – druhá strana zatím nepotvrdila přijetí.", "cooldown_hours": 24},
    },
    {
        "name": "Delegovaný úkol – chybí termín > 48 h",
        "description": "Přijetí potvrzeno, ale stále bez termínu.",
        "condition": {"direction": "delegated", "phases": ["awaiting_eta"], "hours_since_activity_gte": 48},
        "action": {"level": "warning", "message": "Vyžádat konkrétní termín dokončení.", "cooldown_hours": 24},
    },
    {
        "name": "Delegovaný úkol – 24 h před deadline",
        "description": "Termín je za 24 h, zeptat se na status.",
        "condition": {"direction": "delegated", "phases": ["in_progress", "awaiting_result"], "hours_to_deadline_lte": 24, "hours_to_deadline_gte": 0},
        "action": {"level": "info", "message": "Zeptat se na status – deadline za < 24 h.", "cooldown_hours": 12},
    },
    {
        "name": "Delegovaný úkol – po termínu",
        "description": "Deadline prošel.",
        "condition": {"direction": "delegated", "phases": ["in_progress", "awaiting_result"], "hours_past_deadline_gte": 0},
        "action": {"level": "urgent", "message": "Urgovat – termín prošel.", "cooldown_hours": 12},
    },
    {
        "name": "Můj úkol – bez odpovědi > 4 h",
        "description": "Někdo se mě ptá / chce moji odpověď.",
        "condition": {"direction": "mine", "phases": ["new"], "hours_since_activity_gte": 4},
        "action": {"level": "warning", "message": "Odpovědět – druhá strana čeká.", "cooldown_hours": 8},
    },
    {
        "name": "Můj úkol blokovaný",
        "description": "Já jsem zablokovaný a čekám na něco/někoho.",
        "condition": {"direction": "mine", "phases": ["blocked"], "hours_since_activity_gte": 24},
        "action": {"level": "info", "message": "Připomenout si – jsi v blocked stavu déle než den.", "cooldown_hours": 24},
    },
]


def ensure_default_rules(db: Session) -> None:
    if db.execute(select(Rule).limit(1)).first():
        return
    for r in DEFAULT_RULES:
        db.add(Rule(name=r["name"], description=r["description"], enabled=True,
                    condition=r["condition"], action=r["action"]))
    db.commit()


def _hours_between(a: datetime, b: datetime) -> float:
    return (b - a).total_seconds() / 3600


def _matches(task: Task, rule: Rule, now: datetime) -> bool:
    cond = rule.condition or {}
    if cond.get("direction") and task.direction.value != cond["direction"]:
        return False
    if cond.get("phases") and task.phase.value not in cond["phases"]:
        return False
    if task.snoozed_until and task.snoozed_until > now:
        return False
    if "hours_since_activity_gte" in cond:
        if _hours_between(task.last_activity_at, now) < cond["hours_since_activity_gte"]:
            return False
    if "hours_to_deadline_lte" in cond or "hours_to_deadline_gte" in cond:
        if task.deadline is None:
            return False
        h = _hours_between(now, task.deadline)
        if "hours_to_deadline_lte" in cond and h > cond["hours_to_deadline_lte"]:
            return False
        if "hours_to_deadline_gte" in cond and h < cond["hours_to_deadline_gte"]:
            return False
    if "hours_past_deadline_gte" in cond:
        if task.deadline is None:
            return False
        if _hours_between(task.deadline, now) < cond["hours_past_deadline_gte"]:
            return False
    return True


def _recent_notification_exists(db: Session, task_id: int, rule_id: int, cooldown_hours: int, now: datetime) -> bool:
    cutoff = now - timedelta(hours=cooldown_hours)
    stmt = (
        select(Notification)
        .where(Notification.task_id == task_id, Notification.rule_id == rule_id,
               Notification.created_at >= cutoff)
        .limit(1)
    )
    return db.execute(stmt).first() is not None


def evaluate(db: Session) -> dict[str, int]:
    now = datetime.now(timezone.utc)
    rules = list(db.execute(select(Rule).where(Rule.enabled.is_(True))).scalars())
    open_tasks = list(db.execute(
        select(Task).where(Task.closed_at.is_(None), Task.phase != TaskPhase.done, Task.phase != TaskPhase.dropped)
    ).scalars())

    created = 0
    for task in open_tasks:
        for rule in rules:
            if not _matches(task, rule, now):
                continue
            cooldown = int((rule.action or {}).get("cooldown_hours", 24))
            if _recent_notification_exists(db, task.id, rule.id, cooldown, now):
                continue
            level_str = (rule.action or {}).get("level", "info")
            try:
                level = NotificationLevel(level_str)
            except ValueError:
                level = NotificationLevel.info
            msg = (rule.action or {}).get("message", rule.name)
            db.add(Notification(task_id=task.id, rule_id=rule.id, level=level, message=msg))
            created += 1
    if created:
        db.commit()
    return {"checked": len(open_tasks), "created": created}
