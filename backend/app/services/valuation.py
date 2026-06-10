"""Wallet valuation helpers shared by leaderboards, portfolios and snapshots."""

import logging
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Membership, PriceSnapshot
from app.services import market

logger = logging.getLogger(__name__)

TWO_PLACES = Decimal("0.01")


def get_price_with_fallback(db: Session, ticker: str) -> Decimal | None:
    """Live quote if possible, otherwise the most recent stored snapshot."""
    try:
        return market.get_quote(ticker)
    except market.UnknownTickerError:
        pass
    except Exception:
        logger.warning("live quote failed for %s, using snapshot", ticker, exc_info=True)

    snapshot = db.scalars(
        select(PriceSnapshot)
        .where(PriceSnapshot.ticker == ticker)
        .order_by(PriceSnapshot.snapshot_date.desc())
        .limit(1)
    ).first()
    return snapshot.price if snapshot else None


def get_holdings_value(db: Session, membership: Membership) -> tuple[Decimal, list[dict]]:
    """Returns (total position value, per-holding breakdown)."""
    total = Decimal("0")
    breakdown = []
    for holding in membership.holdings:
        price = get_price_with_fallback(db, holding.ticker)
        value = (holding.shares * price).quantize(TWO_PLACES) if price is not None else None
        if value is not None:
            total += value
        breakdown.append(
            {
                "ticker": holding.ticker,
                "shares": holding.shares,
                "avg_cost": holding.avg_cost,
                "current_price": price,
                "market_value": value,
                "cost_basis": (holding.shares * holding.avg_cost).quantize(TWO_PLACES),
            }
        )
    return total, breakdown


def get_total_value(db: Session, membership: Membership) -> Decimal:
    holdings_value, _ = get_holdings_value(db, membership)
    return (membership.cash_balance + holdings_value).quantize(TWO_PLACES)
