"""Monthly allowance crediting.

Each membership tracks `last_allowance_at` (initialized to the join time).
Every time a full month has elapsed since then, the group's monthly allowance
is credited — catching up multiple months if the job hasn't run for a while.
"""

import logging
from datetime import datetime, timezone

from dateutil.relativedelta import relativedelta
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Group, Membership, Transaction, TransactionType

logger = logging.getLogger(__name__)


def credit_due_allowances(db: Session) -> int:
    """Credits every allowance that has come due. Returns number of credits."""
    now = datetime.now(timezone.utc)
    memberships = db.scalars(
        select(Membership).join(Group).where(Group.monthly_allowance > 0)
    ).all()

    credits = 0
    for membership in memberships:
        last = membership.last_allowance_at
        if last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
        while last + relativedelta(months=1) <= now:
            last = last + relativedelta(months=1)
            amount = membership.group.monthly_allowance
            membership.cash_balance += amount
            membership.last_allowance_at = last
            db.add(
                Transaction(
                    membership_id=membership.id,
                    type=TransactionType.ALLOWANCE,
                    amount=amount,
                )
            )
            credits += 1

    if credits:
        db.commit()
        logger.info("Credited %d monthly allowances", credits)
    return credits
