from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Membership(Base):
    """A user's wallet inside a group: holds their fake cash and stock
    positions for that group's game."""

    __tablename__ = "memberships"
    __table_args__ = (UniqueConstraint("user_id", "group_id", name="uq_membership_user_group"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"), index=True)
    cash_balance: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    last_allowance_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="memberships")  # noqa: F821
    group: Mapped["Group"] = relationship(back_populates="memberships")  # noqa: F821
    holdings: Mapped[list["Holding"]] = relationship(  # noqa: F821
        back_populates="membership", cascade="all, delete-orphan"
    )
    transactions: Mapped[list["Transaction"]] = relationship(  # noqa: F821
        back_populates="membership", cascade="all, delete-orphan"
    )
