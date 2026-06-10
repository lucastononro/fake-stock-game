from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.transaction import TransactionType


class Simulation(Base):
    """Time Machine mode: a personal portfolio that starts at a past date and
    is fast-forwarded manually. `current_date` is the simulated "today" — all
    trades and valuations use historical prices on that date."""

    __tablename__ = "simulations"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    start_date: Mapped[date] = mapped_column(Date)
    current_date: Mapped[date] = mapped_column(Date)
    initial_cash: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    cash_balance: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship()  # noqa: F821
    holdings: Mapped[list["SimulationHolding"]] = relationship(
        back_populates="simulation", cascade="all, delete-orphan"
    )
    transactions: Mapped[list["SimulationTransaction"]] = relationship(
        back_populates="simulation", cascade="all, delete-orphan"
    )


class SimulationHolding(Base):
    __tablename__ = "simulation_holdings"
    __table_args__ = (
        UniqueConstraint("simulation_id", "ticker", name="uq_sim_holding_ticker"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    simulation_id: Mapped[int] = mapped_column(ForeignKey("simulations.id"), index=True)
    ticker: Mapped[str] = mapped_column(String(20))
    shares: Mapped[Decimal] = mapped_column(Numeric(18, 6))
    avg_cost: Mapped[Decimal] = mapped_column(Numeric(18, 4))

    simulation: Mapped["Simulation"] = relationship(back_populates="holdings")


class SimulationTransaction(Base):
    """Ledger of a simulation. `sim_date` is the simulated date the action
    happened on (created_at is just the real-world bookkeeping time)."""

    __tablename__ = "simulation_transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    simulation_id: Mapped[int] = mapped_column(ForeignKey("simulations.id"), index=True)
    type: Mapped[TransactionType] = mapped_column(Enum(TransactionType))
    ticker: Mapped[str | None] = mapped_column(String(20), nullable=True)
    shares: Mapped[Decimal | None] = mapped_column(Numeric(18, 6), nullable=True)
    price: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    sim_date: Mapped[date] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    simulation: Mapped["Simulation"] = relationship(back_populates="transactions")
