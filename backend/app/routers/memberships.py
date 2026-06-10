from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Membership, PortfolioSnapshot, Transaction, User
from app.routers.groups import group_out
from app.schemas import (
    PortfolioHistoryPoint,
    PortfolioOut,
    TradeRequest,
    TransactionOut,
)
from app.services import valuation
from app.services.market import UnknownTickerError
from app.services.trading import TradeError, execute_trade

router = APIRouter(prefix="/memberships", tags=["memberships"])


def _get_membership_for_viewer(
    db: Session, membership_id: int, viewer: User
) -> Membership:
    """Members of the same group can view each other's portfolios."""
    membership = db.get(Membership, membership_id)
    if not membership:
        raise HTTPException(404, "Portfolio not found")
    viewer_is_member = any(m.user_id == viewer.id for m in membership.group.memberships)
    if not viewer_is_member:
        raise HTTPException(403, "You are not a member of this group")
    return membership


def _get_own_membership(db: Session, membership_id: int, viewer: User) -> Membership:
    membership = db.get(Membership, membership_id)
    if not membership:
        raise HTTPException(404, "Portfolio not found")
    if membership.user_id != viewer.id:
        raise HTTPException(403, "You can only trade with your own wallet")
    return membership


@router.get("/{membership_id}/portfolio", response_model=PortfolioOut)
def get_portfolio(
    membership_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    membership = _get_membership_for_viewer(db, membership_id, current_user)
    holdings_value, breakdown = valuation.get_holdings_value(db, membership)
    return PortfolioOut(
        membership=membership,
        group=group_out(membership.group),
        user=membership.user,
        holdings=breakdown,
        holdings_value=holdings_value,
        total_value=membership.cash_balance + holdings_value,
        is_mine=membership.user_id == current_user.id,
    )


@router.post("/{membership_id}/trades", response_model=TransactionOut, status_code=201)
def trade(
    membership_id: int,
    payload: TradeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    membership = _get_own_membership(db, membership_id, current_user)
    try:
        return execute_trade(db, membership, payload.side, payload.ticker, payload.shares)
    except UnknownTickerError as exc:
        raise HTTPException(404, str(exc))
    except TradeError as exc:
        raise HTTPException(400, str(exc))


@router.get("/{membership_id}/transactions", response_model=list[TransactionOut])
def list_transactions(
    membership_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_membership_for_viewer(db, membership_id, current_user)
    return db.scalars(
        select(Transaction)
        .where(Transaction.membership_id == membership_id)
        .order_by(Transaction.created_at.desc())
    ).all()


@router.get("/{membership_id}/history", response_model=list[PortfolioHistoryPoint])
def portfolio_history(
    membership_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_membership_for_viewer(db, membership_id, current_user)
    return db.scalars(
        select(PortfolioSnapshot)
        .where(PortfolioSnapshot.membership_id == membership_id)
        .order_by(PortfolioSnapshot.snapshot_date)
    ).all()
