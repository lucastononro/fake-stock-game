from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user, hash_password, verify_password
from app.database import get_db
from app.models import Group, Membership, Transaction, TransactionType, User
from app.schemas import (
    GroupCreate,
    GroupJoinRequest,
    GroupLookup,
    GroupOut,
    LeaderboardEntry,
    MembershipOut,
    MyGroupSummary,
)
from app.services import valuation

router = APIRouter(prefix="/groups", tags=["groups"])


def group_out(group: Group) -> GroupOut:
    out = GroupOut.model_validate(group)
    out.member_count = len(group.memberships)
    out.has_password = group.join_password_hash is not None
    return out


def require_membership(group: Group, user: User) -> Membership:
    membership = next((m for m in group.memberships if m.user_id == user.id), None)
    if not membership:
        raise HTTPException(403, "You are not a member of this group")
    return membership


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


def _leaderboard_entries(db: Session, group: Group) -> list[LeaderboardEntry]:
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


@router.post("", response_model=GroupOut, status_code=201)
def create_group(
    payload: GroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    group = Group(
        name=payload.name,
        owner_id=current_user.id,
        initial_cash=payload.initial_cash,
        monthly_allowance=payload.monthly_allowance,
        join_password_hash=hash_password(payload.password) if payload.password else None,
    )
    db.add(group)
    db.flush()
    _create_membership(db, current_user, group)  # owner joins their own group
    db.commit()
    db.refresh(group)
    return group_out(group)


@router.get("/mine", response_model=list[MyGroupSummary])
def my_groups(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Dashboard data: every group I'm in, with my standing in each."""
    memberships = db.scalars(
        select(Membership).where(Membership.user_id == current_user.id)
    ).all()

    summaries = []
    for membership in memberships:
        group = membership.group
        entries = _leaderboard_entries(db, group)
        mine = next(e for e in entries if e.membership_id == membership.id)
        rank = entries.index(mine) + 1
        summaries.append(
            MyGroupSummary(
                group=group_out(group),
                membership_id=membership.id,
                cash_balance=mine.cash_balance,
                total_value=mine.total_value,
                profit=mine.profit,
                rank=rank,
                is_owner=group.owner_id == current_user.id,
            )
        )
    summaries.sort(key=lambda s: s.group.created_at)
    return summaries


@router.get("/lookup/{invite_code}", response_model=GroupLookup)
def lookup_group(
    invite_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Preview a group by invite code before joining."""
    group = db.scalars(
        select(Group).where(Group.invite_code == invite_code.upper().strip())
    ).first()
    if not group:
        raise HTTPException(404, "No group found with that invite code")
    return GroupLookup(
        name=group.name,
        member_count=len(group.memberships),
        initial_cash=group.initial_cash,
        monthly_allowance=group.monthly_allowance,
        requires_password=group.join_password_hash is not None,
        already_member=any(m.user_id == current_user.id for m in group.memberships),
    )


@router.post("/join", response_model=MembershipOut, status_code=201)
def join_group(
    payload: GroupJoinRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    group = db.scalars(
        select(Group).where(Group.invite_code == payload.invite_code.upper().strip())
    ).first()
    if not group:
        raise HTTPException(404, "No group found with that invite code")
    if group.join_password_hash is not None:
        if not payload.password or not verify_password(
            payload.password, group.join_password_hash
        ):
            raise HTTPException(403, "Wrong group password")
    if any(m.user_id == current_user.id for m in group.memberships):
        raise HTTPException(409, "You are already a member of this group")

    membership = _create_membership(db, current_user, group)
    db.commit()
    db.refresh(membership)
    return membership


@router.get("/{group_id}", response_model=GroupOut)
def get_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    group = db.get(Group, group_id)
    if not group:
        raise HTTPException(404, "Group not found")
    require_membership(group, current_user)
    return group_out(group)


@router.get("/{group_id}/leaderboard", response_model=list[LeaderboardEntry])
def leaderboard(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    group = db.get(Group, group_id)
    if not group:
        raise HTTPException(404, "Group not found")
    require_membership(group, current_user)
    return _leaderboard_entries(db, group)
