"""Buy/sell execution against a membership wallet, at live market prices."""

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Holding, Membership, Transaction, TransactionType
from app.services import market

TWO_PLACES = Decimal("0.01")


class TradeError(Exception):
    pass


def execute_trade(
    db: Session, membership: Membership, side: str, ticker: str, shares: Decimal
) -> Transaction:
    if shares <= 0:
        raise TradeError("Shares must be positive")

    ticker = ticker.upper().strip()
    price = market.get_quote(ticker)  # raises UnknownTickerError for bad tickers
    total = (price * shares).quantize(TWO_PLACES)

    if side == "buy":
        transaction = _buy(db, membership, ticker, shares, price, total)
    elif side == "sell":
        transaction = _sell(db, membership, ticker, shares, price, total)
    else:
        raise TradeError(f"Unknown trade side '{side}'")

    db.commit()
    db.refresh(transaction)
    return transaction


def _buy(
    db: Session,
    membership: Membership,
    ticker: str,
    shares: Decimal,
    price: Decimal,
    total: Decimal,
) -> Transaction:
    if membership.cash_balance < total:
        raise TradeError(
            f"Insufficient cash: need {total}, have {membership.cash_balance}"
        )

    holding = _get_holding(db, membership.id, ticker)
    if holding is None:
        holding = Holding(
            membership_id=membership.id, ticker=ticker, shares=shares, avg_cost=price
        )
        db.add(holding)
    else:
        old_cost = holding.shares * holding.avg_cost
        new_shares = holding.shares + shares
        holding.avg_cost = ((old_cost + total) / new_shares).quantize(Decimal("0.0001"))
        holding.shares = new_shares

    membership.cash_balance -= total
    return _record(db, membership, TransactionType.BUY, ticker, shares, price, -total)


def _sell(
    db: Session,
    membership: Membership,
    ticker: str,
    shares: Decimal,
    price: Decimal,
    total: Decimal,
) -> Transaction:
    holding = _get_holding(db, membership.id, ticker)
    if holding is None or holding.shares < shares:
        held = holding.shares if holding else Decimal("0")
        raise TradeError(f"Insufficient shares of {ticker}: have {held}, selling {shares}")

    holding.shares -= shares
    if holding.shares == 0:
        db.delete(holding)

    membership.cash_balance += total
    return _record(db, membership, TransactionType.SELL, ticker, shares, price, total)


def _get_holding(db: Session, membership_id: int, ticker: str) -> Holding | None:
    return db.scalars(
        select(Holding).where(
            Holding.membership_id == membership_id, Holding.ticker == ticker
        )
    ).first()


def _record(
    db: Session,
    membership: Membership,
    type_: TransactionType,
    ticker: str,
    shares: Decimal,
    price: Decimal,
    amount: Decimal,
) -> Transaction:
    transaction = Transaction(
        membership_id=membership.id,
        type=type_,
        ticker=ticker,
        shares=shares,
        price=price,
        amount=amount,
    )
    db.add(transaction)
    return transaction
