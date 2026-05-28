from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import require_session
from ..db import get_db
from ..models import Setting
from ..schemas import ImapSettingsIn, ImapSettingsOut, ProfileSettingsIn
from ..services.crypto import encrypt

router = APIRouter(prefix="/settings", tags=["settings"], dependencies=[Depends(require_session)])

IMAP_KEY = "mail.imap"
PROFILE_KEY = "profile"


@router.get("/imap", response_model=ImapSettingsOut)
def get_imap(db: Session = Depends(get_db)) -> ImapSettingsOut:
    row = db.get(Setting, IMAP_KEY)
    if row is None:
        return ImapSettingsOut(
            host="", port=993, use_ssl=True, username="",
            sent_folder="Sent", inbox_folder="INBOX", configured=False,
        )
    v = row.value
    return ImapSettingsOut(
        host=v.get("host", ""),
        port=v.get("port", 993),
        use_ssl=v.get("use_ssl", True),
        username=v.get("username", ""),
        sent_folder=v.get("sent_folder", "Sent"),
        inbox_folder=v.get("inbox_folder", "INBOX"),
        configured=bool(v.get("password_enc")),
    )


@router.put("/imap", response_model=ImapSettingsOut)
def set_imap(payload: ImapSettingsIn, db: Session = Depends(get_db)) -> ImapSettingsOut:
    existing = db.get(Setting, IMAP_KEY)
    if payload.password:
        password_enc = encrypt(payload.password)
    elif existing and existing.value.get("password_enc"):
        password_enc = existing.value["password_enc"]
    else:
        raise HTTPException(400, "Pro první uložení je nutné zadat heslo.")
    new_value = {
        "host": payload.host,
        "port": payload.port,
        "use_ssl": payload.use_ssl,
        "username": payload.username,
        "password_enc": password_enc,
        "sent_folder": payload.sent_folder,
        "inbox_folder": payload.inbox_folder,
    }
    if existing is None:
        existing = Setting(key=IMAP_KEY, value=new_value)
        db.add(existing)
    else:
        existing.value = new_value
    db.commit()
    return ImapSettingsOut(
        host=payload.host, port=payload.port, use_ssl=payload.use_ssl,
        username=payload.username, sent_folder=payload.sent_folder,
        inbox_folder=payload.inbox_folder, configured=True,
    )


@router.get("/profile")
def get_profile(db: Session = Depends(get_db)) -> dict:
    row = db.get(Setting, PROFILE_KEY)
    if row is None:
        return {"my_email": "", "my_aliases": [], "my_name": ""}
    return row.value


@router.put("/profile")
def set_profile(payload: ProfileSettingsIn, db: Session = Depends(get_db)) -> dict:
    row = db.get(Setting, PROFILE_KEY) or Setting(key=PROFILE_KEY, value={})
    row.value = payload.model_dump()
    db.merge(row)
    db.commit()
    return row.value
