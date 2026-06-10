from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PriceSnapshot(Base):
    """Daily closing price per ticker, written by the daily update job. Used
    as a fallback when live quotes are unavailable and for history charts."""

    __tablename__ = "price_snapshots"
    __table_args__ = (UniqueConstraint("ticker", "snapshot_date", name="uq_price_ticker_date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    ticker: Mapped[str] = mapped_column(String(20), index=True)
    price: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    snapshot_date: Mapped[date] = mapped_column(Date, index=True)


class PortfolioSnapshot(Base):
    """Daily total value (cash + positions) per wallet, for performance
    tracking over time."""

    __tablename__ = "portfolio_snapshots"
    __table_args__ = (
        UniqueConstraint("membership_id", "snapshot_date", name="uq_portfolio_membership_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    membership_id: Mapped[int] = mapped_column(ForeignKey("memberships.id"), index=True)
    total_value: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    cash_balance: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    snapshot_date: Mapped[date] = mapped_column(Date, index=True)
