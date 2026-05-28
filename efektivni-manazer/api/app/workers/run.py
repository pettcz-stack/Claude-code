import logging
import signal

from apscheduler.schedulers.blocking import BlockingScheduler

from ..config import get_settings
from ..db import Base, SessionLocal, engine
from .. import models  # noqa: F401
from ..services.classifier import sync_mailbox
from ..services.sla import ensure_default_rules, evaluate

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("worker")


def mail_sync_job() -> None:
    try:
        with SessionLocal() as db:
            stats = sync_mailbox(db)
        logger.info("mail_sync: %s", stats)
    except Exception:
        logger.exception("mail_sync selhal")


def sla_tick_job() -> None:
    try:
        with SessionLocal() as db:
            stats = evaluate(db)
        logger.info("sla_tick: %s", stats)
    except Exception:
        logger.exception("sla_tick selhal")


def main() -> None:
    settings = get_settings()
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        ensure_default_rules(db)

    scheduler = BlockingScheduler(timezone=settings.timezone)
    scheduler.add_job(mail_sync_job, "interval", seconds=settings.mail_sync_interval,
                      id="mail_sync", next_run_time=_now_plus(2))
    scheduler.add_job(sla_tick_job, "interval", seconds=settings.sla_tick_interval,
                      id="sla_tick", next_run_time=_now_plus(15))

    def _stop(*_):
        logger.info("Worker se ukončuje…")
        scheduler.shutdown(wait=False)

    signal.signal(signal.SIGTERM, _stop)
    signal.signal(signal.SIGINT, _stop)

    logger.info("Worker startuje – mail_sync každých %ds, sla_tick každých %ds",
                settings.mail_sync_interval, settings.sla_tick_interval)
    scheduler.start()


def _now_plus(seconds: int):
    from datetime import datetime, timedelta
    return datetime.now() + timedelta(seconds=seconds)


if __name__ == "__main__":
    main()
