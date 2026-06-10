from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Group, Membership, Transaction, TransactionType, User
from app.schemas import (
    GroupCreate,
    GroupJoin,
    GroupOut,
    LeaderboardEntry,
    MembershipOut,
)
from app.services import valuation

router = APIRouter(prefix="/groups", tags=["groups"])


def _group_out(group: Group) -> GroupOut:
    out = GroupOut.model_validate(group)
    out.member_count = len(group.memberships)
    return out


def _create_membership(db: Session, user: User, group: Group) -> Membership:
    membership = Membership(
        user_id=user.id,
        group_id=group.id,
        cash_balance=group.initial_cash,
        last_allowance_at=datetime.now(timezone.utc),
    )
    db.add(membership)
    db.flush()
    db.add(
        Transaction(
            membership_id=membership.id,
            type=TransactionType.INITIAL_DEPOSIT,
            amount=group.initial_cash,
        )
    )
    return membership


@router.post("", response_model=GroupOut, status_code=201)
def create_group(payload: GroupCreate, db: Session = Depends(get_db)):
    owner = db.get(User, payload.owner_id)
    if not owner:
        raise HTTPException(404, "Owner user not found")
    group = Group(
        name=payload.name,
        owner_id=owner.id,
        initial_cash=payload.initial_cash,
        monthly_allowance=payload.monthly_allowance,
    )
    db.add(group)
    db.flush()
    _create_membership(db, owner, group)  # owner joins their own group automatically
    db.commit()
    db.refresh(group)
    return _group_out(group)


@router.get("", response_model=list[GroupOut])
def list_groups(db: Session = Depends(get_db)):
    groups = db.scalars(select(Group).order_by(Group.created_at)).all()
    return [_group_out(g) for g in groups]


@router.get("/{group_id}", response_model=GroupOut)
def get_group(group_id: int, db: Session = Depends(get_db)):
    group = db.get(Group, group_id)
    if not group:
        raise HTTPException(404, "Group not found")
    return _group_out(group)


@router.post("/{group_id}/join", response_model=MembershipOut, status_code=201)
def join_group(group_id: int, payload: GroupJoin, db: Session = Depends(get_db)):
    group = db.get(Group, group_id)
    if not group:
        raise HTTPException(404, "Group not found")
    user = db.get(User, payload.user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if payload.invite_code is not None and payload.invite_code != group.invite_code:
        raise HTTPException(403, "Invalid invite code")
    existing = db.scalars(
        select(Membership).where(
            Membership.user_id == user.id, Membership.group_id == group.id
        )
    ).first()
    if existing:
        raise HTTPException(409, "User is already a member of this group")

    membership = _create_membership(db, user, group)
    db.commit()
    db.refresh(membership)
    return membership


@router.get("/{group_id}/members", response_model=list[MembershipOut])
def list_members(group_id: int, db: Session = Depends(get_db)):
    group = db.get(Group, group_id)
    if not group:
        raise HTTPException(404, "Group not found")
    return group.memberships


@router.get("/{group_id}/leaderboard", response_model=list[LeaderboardEntry])
def leaderboard(group_id: int, db: Session = Depends(get_db)):
    group = db.get(Group, group_id)
    if not group:
        raise HTTPException(404, "Group not found")

    entries = []
    for membership in group.memberships:
        holdings_value, _ = valuation.get_holdings_value(db, membership)
        total = membership.cash_balance + holdings_value
        deposited = group.initial_cash + sum(
            (t.amount for t in membership.transactions if t.type == TransactionType.ALLOWANCE),
            start=0,
        )
        profit = total - deposited
        entries.append(
            LeaderboardEntry(
                membership_id=membership.id,
                user=membership.user,
                cash_balance=membership.cash_balance,
                holdings_value=holdings_value,
                total_value=total,
                profit=profit,
                profit_pct=round(profit / deposited * 100, 2) if deposited else 0,
            )
        )
    entries.sort(key=lambda e: e.total_value, reverse=True)
    return entries
