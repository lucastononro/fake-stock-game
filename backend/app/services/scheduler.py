import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.config import settings
from app.database import SessionLocal
from app.services.daily_update import run_daily_update

logger = logging.getLogger(__name__)


def _daily_update_job():
    db = SessionLocal()
    try:
        run_daily_update(db)
    except Exception:
        logger.exception("Daily update job failed")
    finally:
        db.close()


def start_scheduler() -> BackgroundScheduler | None:
    if not settings.scheduler_enabled:
        return None
    scheduler = BackgroundScheduler(timezone="UTC")
    scheduler.add_job(
        _daily_update_job,
        CronTrigger(hour=settings.daily_update_hour_utc, minute=0),
        id="daily_update",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Scheduler started: daily update at %02d:00 UTC", settings.daily_update_hour_utc)
    return scheduler
