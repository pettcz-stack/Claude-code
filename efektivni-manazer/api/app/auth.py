from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import Cookie, Depends, HTTPException, status
from itsdangerous import BadSignature, URLSafeSerializer
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db
from .models import Setting

PASSWORD_SETTING_KEY = "auth.master_password_hash"
SESSION_COOKIE = "efektivni_session"

_ph = PasswordHasher()


def _serializer() -> URLSafeSerializer:
    return URLSafeSerializer(get_settings().efektivni_session_secret, salt="efektivni-session")


def ensure_master_password(db: Session) -> None:
    """Při prvním běhu uloží hash z env do DB. Pokud už hash je, env se ignoruje."""
    row = db.get(Setting, PASSWORD_SETTING_KEY)
    if row is None:
        env_pwd = get_settings().efektivni_master_password
        row = Setting(key=PASSWORD_SETTING_KEY, value={"hash": _ph.hash(env_pwd)})
        db.add(row)
        db.commit()


def verify_password(db: Session, password: str) -> bool:
    row = db.get(Setting, PASSWORD_SETTING_KEY)
    if row is None:
        return False
    try:
        return _ph.verify(row.value["hash"], password)
    except VerifyMismatchError:
        return False


def make_session_cookie() -> str:
    return _serializer().dumps({"v": 1, "ok": True})


def require_session(efektivni_session: str | None = Cookie(default=None)) -> None:
    if not efektivni_session:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Nepřihlášen")
    try:
        data = _serializer().loads(efektivni_session)
    except BadSignature:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Neplatná session")
    if not data.get("ok"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Neplatná session")
