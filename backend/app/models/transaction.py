import enum
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TransactionType(str, enum.Enum):
    BUY = "BUY"
    SELL = "SELL"
    INITIAL_DEPOSIT = "INITIAL_DEPOSIT"
    ALLOWANCE = "ALLOWANCE"


class Transaction(Base):
    """Ledger of every cash movement in a wallet. `amount` is the signed cash
    delta (negative for buys, positive for sells and deposits)."""

    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    membership_id: Mapped[int] = mapped_column(ForeignKey("memberships.id"), index=True)
    type: Mapped[TransactionType] = mapped_column(Enum(TransactionType))
    ticker: Mapped[str | None] = mapped_column(String(20), nullable=True)
    shares: Mapped[Decimal | None] = mapped_column(Numeric(18, 6), nullable=True)
    price: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    membership: Mapped["Membership"] = relationship(back_populates="transactions")  # noqa: F821
