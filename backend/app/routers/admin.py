from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.daily_update import run_daily_update

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/run-daily-update")
def trigger_daily_update(db: Session = Depends(get_db)):
    """Manually trigger the daily price/portfolio snapshot + allowance job."""
    return run_daily_update(db)
