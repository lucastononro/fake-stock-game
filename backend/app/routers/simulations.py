from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Simulation, SimulationTransaction, TransactionType, User
from app.schemas import (
    ChartPoint,
    SimAdvanceRequest,
    SimQuoteOut,
    SimulationCreate,
    SimulationDetail,
    SimulationOut,
    SimulationSummary,
    SimulationTransactionOut,
    TradeRequest,
)
from app.services import simulation as sim_service
from app.services.simulation import SimulationError

router = APIRouter(prefix="/simulations", tags=["simulations"])


def _get_own_simulation(db: Session, simulation_id: int, user: User) -> Simulation:
    simulation = db.get(Simulation, simulation_id)
    if not simulation or simulation.user_id != user.id:
        raise HTTPException(404, "Simulation not found")
    return simulation


def _summary(simulation: Simulation) -> SimulationSummary:
    holdings_value, _ = sim_service.get_holdings_value(simulation)
    total = simulation.cash_balance + holdings_value
    return SimulationSummary(
        simulation=simulation,
        total_value=total,
        profit=total - simulation.initial_cash,
    )


@router.post("", response_model=SimulationOut, status_code=201)
def create_simulation(
    payload: SimulationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    simulation = Simulation(
        user_id=current_user.id,
        name=payload.name,
        start_date=payload.start_date,
        current_date=payload.start_date,
        initial_cash=payload.initial_cash,
        cash_balance=payload.initial_cash,
    )
    db.add(simulation)
    db.flush()
    db.add(
        SimulationTransaction(
            simulation_id=simulation.id,
            type=TransactionType.INITIAL_DEPOSIT,
            amount=payload.initial_cash,
            sim_date=payload.start_date,
        )
    )
    db.commit()
    db.refresh(simulation)
    return simulation


@router.get("", response_model=list[SimulationSummary])
def list_simulations(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    simulations = db.scalars(
        select(Simulation)
        .where(Simulation.user_id == current_user.id)
        .order_by(Simulation.created_at)
    ).all()
    return [_summary(s) for s in simulations]


@router.get("/{simulation_id}", response_model=SimulationDetail)
def get_simulation(
    simulation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    simulation = _get_own_simulation(db, simulation_id, current_user)
    holdings_value, breakdown = sim_service.get_holdings_value(simulation)
    total = simulation.cash_balance + holdings_value
    profit = total - simulation.initial_cash
    return SimulationDetail(
        simulation=simulation,
        holdings=breakdown,
        holdings_value=holdings_value,
        total_value=total,
        profit=profit,
        profit_pct=round(profit / simulation.initial_cash * 100, 2)
        if simulation.initial_cash
        else 0,
    )


@router.delete("/{simulation_id}", status_code=204)
def delete_simulation(
    simulation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    simulation = _get_own_simulation(db, simulation_id, current_user)
    db.delete(simulation)
    db.commit()


@router.post("/{simulation_id}/trades", response_model=SimulationTransactionOut, status_code=201)
def trade(
    simulation_id: int,
    payload: TradeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    simulation = _get_own_simulation(db, simulation_id, current_user)
    try:
        return sim_service.execute_sim_trade(
            db, simulation, payload.side, payload.ticker, payload.shares
        )
    except SimulationError as exc:
        raise HTTPException(400, str(exc))


@router.post("/{simulation_id}/advance", response_model=SimulationOut)
def advance(
    simulation_id: int,
    payload: SimAdvanceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    simulation = _get_own_simulation(db, simulation_id, current_user)
    try:
        return sim_service.advance_time(db, simulation, payload.amount, payload.unit)
    except SimulationError as exc:
        raise HTTPException(400, str(exc))


@router.get("/{simulation_id}/quote", response_model=SimQuoteOut)
def quote(
    simulation_id: int,
    ticker: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    simulation = _get_own_simulation(db, simulation_id, current_user)
    try:
        price = sim_service.get_sim_price(simulation, ticker)
    except SimulationError as exc:
        raise HTTPException(404, str(exc))
    return SimQuoteOut(
        ticker=ticker.upper().strip(), price=price, date=simulation.current_date
    )


@router.get("/{simulation_id}/transactions", response_model=list[SimulationTransactionOut])
def list_transactions(
    simulation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    simulation = _get_own_simulation(db, simulation_id, current_user)
    return sorted(simulation.transactions, key=lambda t: (t.sim_date, t.id), reverse=True)


@router.get("/{simulation_id}/chart", response_model=list[ChartPoint])
def chart(
    simulation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    simulation = _get_own_simulation(db, simulation_id, current_user)
    return sim_service.build_value_series(simulation)
