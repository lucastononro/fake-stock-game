"""Time Machine mode: trading and valuation at historical prices, plus
fast-forwarding the simulated clock."""

import logging
from datetime import date
from decimal import Decimal

from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import Session

from app.models import Simulation, SimulationHolding, SimulationTransaction, TransactionType
from app.services import charts, market

logger = logging.getLogger(__name__)

TWO_PLACES = Decimal("0.01")


class SimulationError(Exception):
    pass


def get_sim_price(simulation: Simulation, ticker: str) -> Decimal:
    price = market.get_price_on(ticker, simulation.current_date)
    if price is None:
        raise SimulationError(
            f"No market data for {ticker} on {simulation.current_date.isoformat()} — "
            "it may not have been listed yet"
        )
    return price


def execute_sim_trade(
    db: Session, simulation: Simulation, side: str, ticker: str, shares: Decimal
) -> SimulationTransaction:
    if shares <= 0:
        raise SimulationError("Shares must be positive")

    ticker = ticker.upper().strip()
    price = get_sim_price(simulation, ticker)
    total = (price * shares).quantize(TWO_PLACES)
    holding = next((h for h in simulation.holdings if h.ticker == ticker), None)

    if side == "buy":
        if simulation.cash_balance < total:
            raise SimulationError(
                f"Insufficient cash: need {total}, have {simulation.cash_balance}"
            )
        if holding is None:
            holding = SimulationHolding(
                simulation_id=simulation.id, ticker=ticker, shares=shares, avg_cost=price
            )
            db.add(holding)
        else:
            old_cost = holding.shares * holding.avg_cost
            new_shares = holding.shares + shares
            holding.avg_cost = ((old_cost + total) / new_shares).quantize(Decimal("0.0001"))
            holding.shares = new_shares
        simulation.cash_balance -= total
        amount = -total
        type_ = TransactionType.BUY
    elif side == "sell":
        if holding is None or holding.shares < shares:
            held = holding.shares if holding else Decimal("0")
            raise SimulationError(
                f"Insufficient shares of {ticker}: have {held}, selling {shares}"
            )
        holding.shares -= shares
        if holding.shares == 0:
            db.delete(holding)
        simulation.cash_balance += total
        amount = total
        type_ = TransactionType.SELL
    else:
        raise SimulationError(f"Unknown trade side '{side}'")

    transaction = SimulationTransaction(
        simulation_id=simulation.id,
        type=type_,
        ticker=ticker,
        shares=shares,
        price=price,
        amount=amount,
        sim_date=simulation.current_date,
    )
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    return transaction


def advance_time(db: Session, simulation: Simulation, amount: int, unit: str) -> Simulation:
    deltas = {
        "days": relativedelta(days=amount),
        "weeks": relativedelta(weeks=amount),
        "months": relativedelta(months=amount),
    }
    if unit not in deltas:
        raise SimulationError(f"Unknown time unit '{unit}'")
    new_date = min(simulation.current_date + deltas[unit], date.today())
    if new_date == simulation.current_date:
        raise SimulationError("The simulation has caught up with today — it can't go further")
    simulation.current_date = new_date
    db.commit()
    db.refresh(simulation)
    return simulation


def get_holdings_value(simulation: Simulation) -> tuple[Decimal, list[dict]]:
    """Position values at the simulation's current date."""
    total = Decimal("0")
    breakdown = []
    for holding in simulation.holdings:
        price = market.get_price_on(holding.ticker, simulation.current_date)
        value = (holding.shares * price).quantize(TWO_PLACES) if price is not None else None
        if value is not None:
            total += value
        breakdown.append(
            {
                "ticker": holding.ticker,
                "shares": holding.shares,
                "avg_cost": holding.avg_cost,
                "current_price": price,
                "market_value": value,
                "cost_basis": (holding.shares * holding.avg_cost).quantize(TWO_PLACES),
            }
        )
    return total, breakdown


def build_value_series(simulation: Simulation) -> list[dict]:
    """Daily total/cash/stocks/per-ticker values from start to the current
    simulated date, replayed from the ledger."""
    records = [
        {
            "date": t.sim_date,
            "type": t.type,
            "ticker": t.ticker,
            "shares": t.shares,
            "amount": t.amount,
        }
        for t in sorted(simulation.transactions, key=lambda t: (t.sim_date, t.id))
    ]
    return charts.build_series(records, simulation.start_date, simulation.current_date)
