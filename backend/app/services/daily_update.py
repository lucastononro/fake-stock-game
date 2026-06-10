"""The daily update job: credit allowances, snapshot prices for every held
ticker, and record each wallet's total value for the day."""

import logging
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Holding, Membership, PortfolioSnapshot, PriceSnapshot
from app.services import valuation
from app.services.allowance import credit_due_allowances

logger = logging.getLogger(__name__)


def run_daily_update(db: Session) -> dict:
    today = date.today()
    allowances = credit_due_allowances(db)
    prices = _snapshot_prices(db, today)
    portfolios = _snapshot_portfolios(db, today)
    db.commit()

    summary = {
        "date": today.isoformat(),
        "allowances_credited": allowances,
        "tickers_updated": prices,
        "portfolios_updated": portfolios,
    }
    logger.info("Daily update complete: %s", summary)
    return summary


def _snapshot_prices(db: Session, today: date) -> int:
    tickers = db.scalars(select(Holding.ticker).distinct()).all()
    updated = 0
    for ticker in tickers:
        price = valuation.get_price_with_fallback(db, ticker)
        if price is None:
            logger.warning("No price available for %s, skipping snapshot", ticker)
            continue
        existing = db.scalars(
            select(PriceSnapshot).where(
                PriceSnapshot.ticker == ticker, PriceSnapshot.snapshot_date == today
            )
        ).first()
        if existing:
            existing.price = price
        else:
            db.add(PriceSnapshot(ticker=ticker, price=price, snapshot_date=today))
        updated += 1
    return updated


def _snapshot_portfolios(db: Session, today: date) -> int:
    memberships = db.scalars(select(Membership)).all()
    for membership in memberships:
        total = valuation.get_total_value(db, membership)
        existing = db.scalars(
            select(PortfolioSnapshot).where(
                PortfolioSnapshot.membership_id == membership.id,
                PortfolioSnapshot.snapshot_date == today,
            )
        ).first()
        if existing:
            existing.total_value = total
            existing.cash_balance = membership.cash_balance
        else:
            db.add(
                PortfolioSnapshot(
                    membership_id=membership.id,
                    total_value=total,
                    cash_balance=membership.cash_balance,
                    snapshot_date=today,
                )
            )
    return len(memberships)
