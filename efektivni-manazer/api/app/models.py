from datetime import datetime
from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from .db import Base


class TaskDirection(str, enum.Enum):
    delegated = "delegated"  # ja -> nekdo
    mine = "mine"            # nekdo -> ja


class TaskPhase(str, enum.Enum):
    new = "new"
    awaiting_ack = "awaiting_ack"
    awaiting_eta = "awaiting_eta"
    in_progress = "in_progress"
    awaiting_result = "awaiting_result"
    blocked = "blocked"
    acked = "acked"
    done = "done"
    dropped = "dropped"


class NotificationLevel(str, enum.Enum):
    info = "info"
    warning = "warning"
    urgent = "urgent"


class Thread(Base):
    __tablename__ = "threads"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    subject: Mapped[str] = mapped_column(String(1024), default="")
    participants: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_ignored: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    messages: Mapped[list["Message"]] = relationship(back_populates="thread", cascade="all, delete-orphan")
    tasks: Mapped[list["Task"]] = relationship(back_populates="thread", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (UniqueConstraint("message_id_hdr", name="uq_messages_message_id_hdr"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    thread_id: Mapped[int] = mapped_column(ForeignKey("threads.id", ondelete="CASCADE"), index=True)
    message_id_hdr: Mapped[str] = mapped_column(String(998), index=True)
    in_reply_to: Mapped[str | None] = mapped_column(String(998))
    folder: Mapped[str] = mapped_column(String(64), default="INBOX")  # INBOX / Sent
    direction: Mapped[str] = mapped_column(String(16))  # inbound / outbound
    from_addr: Mapped[str] = mapped_column(String(320))
    to_addrs: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    cc_addrs: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    subject: Mapped[str] = mapped_column(String(1024), default="")
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    body_text: Mapped[str] = mapped_column(Text, default="")
    body_html: Mapped[str] = mapped_column(Text, default="")
    raw_headers: Mapped[dict] = mapped_column(JSONB, default=dict)

    thread: Mapped["Thread"] = relationship(back_populates="messages")


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    thread_id: Mapped[int] = mapped_column(ForeignKey("threads.id", ondelete="CASCADE"), index=True)
    direction: Mapped[TaskDirection] = mapped_column(SAEnum(TaskDirection, name="task_direction"))
    phase: Mapped[TaskPhase] = mapped_column(SAEnum(TaskPhase, name="task_phase"), default=TaskPhase.new)

    counterpart_email: Mapped[str] = mapped_column(String(320), default="")
    counterpart_name: Mapped[str] = mapped_column(String(255), default="")
    title: Mapped[str] = mapped_column(String(512), default="")
    summary: Mapped[str] = mapped_column(Text, default="")
    requested_output: Mapped[str] = mapped_column(Text, default="")
    deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_activity_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    snoozed_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    manual_overrides: Mapped[dict] = mapped_column(JSONB, default=dict)
    extractor_meta: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    thread: Mapped["Thread"] = relationship(back_populates="tasks")
    notifications: Mapped[list["Notification"]] = relationship(back_populates="task", cascade="all, delete-orphan")


Index("ix_tasks_direction_phase", Task.direction, Task.phase)


class Rule(Base):
    __tablename__ = "rules"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    # condition: { direction, phase, min_hours_since_activity, max_hours_to_deadline, has_deadline }
    condition: Mapped[dict] = mapped_column(JSONB, default=dict)
    # action: { level, message_template, cooldown_hours }
    action: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), index=True)
    rule_id: Mapped[int | None] = mapped_column(ForeignKey("rules.id", ondelete="SET NULL"))
    level: Mapped[NotificationLevel] = mapped_column(SAEnum(NotificationLevel, name="notification_level"))
    message: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    snoozed_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    dismissed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    task: Mapped["Task"] = relationship(back_populates="notifications")


class Setting(Base):
    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[dict] = mapped_column(JSONB, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
