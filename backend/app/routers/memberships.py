from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Membership, PortfolioSnapshot, Transaction
from app.schemas import (
    GroupOut,
    PortfolioHistoryPoint,
    PortfolioOut,
    TradeRequest,
    TransactionOut,
)
from app.services import valuation
from app.services.market import UnknownTickerError
from app.services.trading import TradeError, execute_trade

router = APIRouter(prefix="/memberships", tags=["memberships"])


def _get_membership(db: Session, membership_id: int) -> Membership:
    membership = db.get(Membership, membership_id)
    if not membership:
        raise HTTPException(404, "Membership not found")
    return membership


@router.get("/{membership_id}/portfolio", response_model=PortfolioOut)
def get_portfolio(membership_id: int, db: Session = Depends(get_db)):
    membership = _get_membership(db, membership_id)
    holdings_value, breakdown = valuation.get_holdings_value(db, membership)
    group_out = GroupOut.model_validate(membership.group)
    group_out.member_count = len(membership.group.memberships)
    return PortfolioOut(
        membership=membership,
        group=group_out,
        user=membership.user,
        holdings=breakdown,
        holdings_value=holdings_value,
        total_value=membership.cash_balance + holdings_value,
    )


@router.post("/{membership_id}/trades", response_model=TransactionOut, status_code=201)
def trade(membership_id: int, payload: TradeRequest, db: Session = Depends(get_db)):
    membership = _get_membership(db, membership_id)
    try:
        return execute_trade(db, membership, payload.side, payload.ticker, payload.shares)
    except UnknownTickerError as exc:
        raise HTTPException(404, str(exc))
    except TradeError as exc:
        raise HTTPException(400, str(exc))


@router.get("/{membership_id}/transactions", response_model=list[TransactionOut])
def list_transactions(membership_id: int, db: Session = Depends(get_db)):
    _get_membership(db, membership_id)
    return db.scalars(
        select(Transaction)
        .where(Transaction.membership_id == membership_id)
        .order_by(Transaction.created_at.desc())
    ).all()


@router.get("/{membership_id}/history", response_model=list[PortfolioHistoryPoint])
def portfolio_history(membership_id: int, db: Session = Depends(get_db)):
    _get_membership(db, membership_id)
    return db.scalars(
        select(PortfolioSnapshot)
        .where(PortfolioSnapshot.membership_id == membership_id)
        .order_by(PortfolioSnapshot.snapshot_date)
    ).all()
