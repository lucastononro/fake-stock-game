import secrets
import string
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _generate_invite_code() -> str:
    """Short, friendly, unambiguous code like 'KX7M2APQ'."""
    alphabet = "".join(c for c in string.ascii_uppercase + string.digits if c not in "O0I1L")
    return "".join(secrets.choice(alphabet) for _ in range(8))


class Group(Base):
    """A fake-stock competition room. Members get `initial_cash` when they
    join and `monthly_allowance` credited every month thereafter. Joining is
    by invite code, optionally protected by a password."""

    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    initial_cash: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    monthly_allowance: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0"))
    invite_code: Mapped[str] = mapped_column(
        String(16), unique=True, index=True, default=_generate_invite_code
    )
    join_password_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    owner: Mapped["User"] = relationship()  # noqa: F821
    memberships: Mapped[list["Membership"]] = relationship(  # noqa: F821
        back_populates="group", cascade="all, delete-orphan"
    )
