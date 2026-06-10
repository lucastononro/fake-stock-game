from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models import TransactionType


# ---------- Users ----------

class UserCreate(BaseModel):
    username: str = Field(min_length=2, max_length=50, pattern=r"^[a-zA-Z0-9_.-]+$")
    display_name: str = Field(min_length=1, max_length=100)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    display_name: str
    created_at: datetime


# ---------- Groups ----------

class GroupCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    owner_id: int
    initial_cash: Decimal = Field(gt=0, le=Decimal("1000000000"))
    monthly_allowance: Decimal = Field(ge=0, le=Decimal("1000000000"))


class GroupOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    owner_id: int
    initial_cash: Decimal
    monthly_allowance: Decimal
    invite_code: str
    created_at: datetime
    member_count: int = 0


class GroupJoin(BaseModel):
    user_id: int
    invite_code: str | None = None


# ---------- Memberships / Portfolio ----------

class MembershipOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    group_id: int
    cash_balance: Decimal
    joined_at: datetime


class HoldingOut(BaseModel):
    ticker: str
    shares: Decimal
    avg_cost: Decimal
    current_price: Decimal | None
    market_value: Decimal | None
    cost_basis: Decimal


class PortfolioOut(BaseModel):
    membership: MembershipOut
    group: GroupOut
    user: UserOut
    holdings: list[HoldingOut]
    holdings_value: Decimal
    total_value: Decimal


class PortfolioHistoryPoint(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    snapshot_date: date
    total_value: Decimal
    cash_balance: Decimal


# ---------- Trades / Transactions ----------

class TradeRequest(BaseModel):
    side: Literal["buy", "sell"]
    ticker: str = Field(min_length=1, max_length=20)
    shares: Decimal = Field(gt=0)


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: TransactionType
    ticker: str | None
    shares: Decimal | None
    price: Decimal | None
    amount: Decimal
    created_at: datetime


# ---------- Leaderboard ----------

class LeaderboardEntry(BaseModel):
    membership_id: int
    user: UserOut
    cash_balance: Decimal
    holdings_value: Decimal
    total_value: Decimal
    profit: Decimal
    profit_pct: Decimal


# ---------- Stocks ----------

class StockSearchResult(BaseModel):
    ticker: str
    name: str
    exchange: str
    type: str


class QuoteOut(BaseModel):
    ticker: str
    price: Decimal


class HistoryPoint(BaseModel):
    date: str
    close: float
