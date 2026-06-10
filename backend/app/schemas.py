from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models import TransactionType


# ---------- Auth / Users ----------

class RegisterRequest(BaseModel):
    username: str = Field(min_length=2, max_length=50, pattern=r"^[a-zA-Z0-9_.-]+$")
    display_name: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=6, max_length=128)


class LoginRequest(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    display_name: str
    created_at: datetime


class AuthResponse(BaseModel):
    token: str
    user: UserOut


# ---------- Groups ----------

class GroupCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    initial_cash: Decimal = Field(gt=0, le=Decimal("1000000000"))
    monthly_allowance: Decimal = Field(ge=0, le=Decimal("1000000000"))
    password: str | None = Field(default=None, min_length=4, max_length=128)


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
    has_password: bool = False


class GroupJoinRequest(BaseModel):
    invite_code: str = Field(min_length=4, max_length=16)
    password: str | None = None


class GroupLookup(BaseModel):
    """Preview shown before joining a group by invite code."""

    name: str
    member_count: int
    initial_cash: Decimal
    monthly_allowance: Decimal
    requires_password: bool
    already_member: bool


class MyGroupSummary(BaseModel):
    """One card on the dashboard: a group plus my wallet's standing in it."""

    group: GroupOut
    membership_id: int
    cash_balance: Decimal
    total_value: Decimal
    profit: Decimal
    rank: int
    is_owner: bool


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
    is_mine: bool


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


# ---------- Simulations (Time Machine mode) ----------

class SimulationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    start_date: date
    initial_cash: Decimal = Field(gt=0, le=Decimal("1000000000"))

    @field_validator("start_date")
    @classmethod
    def must_be_in_past(cls, value: date) -> date:
        if value >= date.today():
            raise ValueError("start_date must be in the past")
        if value < date(1980, 1, 1):
            raise ValueError("start_date must be 1980 or later")
        return value


class SimulationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    start_date: date
    current_date: date
    initial_cash: Decimal
    cash_balance: Decimal
    created_at: datetime


class SimulationSummary(BaseModel):
    simulation: SimulationOut
    total_value: Decimal
    profit: Decimal


class SimulationDetail(BaseModel):
    simulation: SimulationOut
    holdings: list[HoldingOut]
    holdings_value: Decimal
    total_value: Decimal
    profit: Decimal
    profit_pct: Decimal


class SimAdvanceRequest(BaseModel):
    amount: int = Field(gt=0, le=520)
    unit: Literal["days", "weeks", "months"]


class SimQuoteOut(BaseModel):
    ticker: str
    price: Decimal
    date: date


class SimulationTransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: TransactionType
    ticker: str | None
    shares: Decimal | None
    price: Decimal | None
    amount: Decimal
    sim_date: date


class SimChartPoint(BaseModel):
    date: date
    total_value: Decimal


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
