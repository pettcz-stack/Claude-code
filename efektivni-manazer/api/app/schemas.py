from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    thread_id: int
    direction: str
    phase: str
    counterpart_email: str
    counterpart_name: str
    title: str
    summary: str
    requested_output: str
    deadline: datetime | None
    last_activity_at: datetime
    snoozed_until: datetime | None
    closed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class TaskUpdate(BaseModel):
    phase: str | None = None
    title: str | None = None
    summary: str | None = None
    deadline: datetime | None = None
    snoozed_until: datetime | None = None
    closed: bool | None = None


class TaskCreate(BaseModel):
    direction: Literal["delegated", "mine"]
    title: str
    summary: str = ""
    requested_output: str = ""
    counterpart_email: str = ""
    counterpart_name: str = ""
    deadline: datetime | None = None
    phase: str = "new"


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    direction: str
    from_addr: str
    to_addrs: list[str]
    cc_addrs: list[str]
    subject: str
    date: datetime
    body_text: str


class ThreadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    subject: str
    participants: list[str]
    last_message_at: datetime | None
    is_ignored: bool


class ThreadDetail(ThreadOut):
    messages: list[MessageOut]
    tasks: list[TaskOut]


class RuleIn(BaseModel):
    name: str
    description: str = ""
    enabled: bool = True
    condition: dict[str, Any] = Field(default_factory=dict)
    action: dict[str, Any] = Field(default_factory=dict)


class RuleOut(RuleIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: int
    rule_id: int | None
    level: str
    message: str
    created_at: datetime
    snoozed_until: datetime | None
    dismissed_at: datetime | None


class LoginIn(BaseModel):
    password: str


class ImapSettingsIn(BaseModel):
    host: str
    port: int = 993
    use_ssl: bool = True
    username: str
    password: str | None = None  # None = ponechat stávající
    sent_folder: str = "Sent"
    inbox_folder: str = "INBOX"


class ImapSettingsOut(BaseModel):
    host: str
    port: int
    use_ssl: bool
    username: str
    sent_folder: str
    inbox_folder: str
    configured: bool


class ProfileSettingsIn(BaseModel):
    my_email: EmailStr
    my_aliases: list[str] = Field(default_factory=list)
    my_name: str = ""
