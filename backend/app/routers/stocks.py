from fastapi import APIRouter, HTTPException, Query

from app.schemas import HistoryPoint, QuoteOut, StockSearchResult
from app.services import market
from app.services.market import UnknownTickerError

router = APIRouter(prefix="/stocks", tags=["stocks"])

VALID_PERIODS = {"5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "max"}


@router.get("/search", response_model=list[StockSearchResult])
def search_stocks(q: str = Query(min_length=1, max_length=50)):
    return market.search(q)


@router.get("/{ticker}/quote", response_model=QuoteOut)
def get_quote(ticker: str):
    try:
        return QuoteOut(ticker=ticker.upper(), price=market.get_quote(ticker))
    except UnknownTickerError as exc:
        raise HTTPException(404, str(exc))


@router.get("/{ticker}/history", response_model=list[HistoryPoint])
def get_history(ticker: str, period: str = "1mo"):
    if period not in VALID_PERIODS:
        raise HTTPException(400, f"period must be one of {sorted(VALID_PERIODS)}")
    try:
        return market.get_history(ticker, period)
    except UnknownTickerError as exc:
        raise HTTPException(404, str(exc))
