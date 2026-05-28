from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from ..auth import SESSION_COOKIE, make_session_cookie, verify_password
from ..db import get_db
from ..schemas import LoginIn

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
def login(payload: LoginIn, response: Response, db: Session = Depends(get_db)) -> dict[str, bool]:
    if not verify_password(db, payload.password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Špatné heslo")
    response.set_cookie(
        SESSION_COOKIE,
        make_session_cookie(),
        httponly=True,
        samesite="lax",
        secure=False,  # lokal dev
        max_age=60 * 60 * 24 * 30,
    )
    return {"ok": True}


@router.post("/logout")
def logout(response: Response) -> dict[str, bool]:
    response.delete_cookie(SESSION_COOKIE)
    return {"ok": True}
