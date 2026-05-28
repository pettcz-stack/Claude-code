from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import require_session
from ..db import get_db
from ..models import Rule
from ..schemas import RuleIn, RuleOut

router = APIRouter(prefix="/rules", tags=["rules"], dependencies=[Depends(require_session)])


@router.get("", response_model=list[RuleOut])
def list_rules(db: Session = Depends(get_db)) -> list[Rule]:
    return list(db.execute(select(Rule).order_by(Rule.id)).scalars())


@router.post("", response_model=RuleOut)
def create_rule(payload: RuleIn, db: Session = Depends(get_db)) -> Rule:
    r = Rule(**payload.model_dump())
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


@router.put("/{rule_id}", response_model=RuleOut)
def update_rule(rule_id: int, payload: RuleIn, db: Session = Depends(get_db)) -> Rule:
    r = db.get(Rule, rule_id)
    if r is None:
        raise HTTPException(404, "Pravidlo neexistuje")
    for k, v in payload.model_dump().items():
        setattr(r, k, v)
    db.commit()
    db.refresh(r)
    return r


@router.delete("/{rule_id}")
def delete_rule(rule_id: int, db: Session = Depends(get_db)) -> dict[str, bool]:
    r = db.get(Rule, rule_id)
    if r is None:
        raise HTTPException(404, "Pravidlo neexistuje")
    db.delete(r)
    db.commit()
    return {"ok": True}
