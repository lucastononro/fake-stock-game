"""Market data access, backed by Yahoo Finance (via yfinance).

Quotes are cached in-process for a short TTL so leaderboard/portfolio
valuations don't hammer the API.
"""

import logging
import time
from decimal import Decimal

import yfinance as yf

from app.config import settings

logger = logging.getLogger(__name__)

_quote_cache: dict[str, tuple[Decimal, float]] = {}


class UnknownTickerError(Exception):
    def __init__(self, ticker: str):
        self.ticker = ticker
        super().__init__(f"No price data found for ticker '{ticker}'")


def get_quote(ticker: str) -> Decimal:
    """Latest price for a ticker, cached for `quote_cache_ttl_seconds`."""
    ticker = ticker.upper().strip()
    cached = _quote_cache.get(ticker)
    if cached and time.time() - cached[1] < settings.quote_cache_ttl_seconds:
        return cached[0]

    price = _fetch_price(ticker)
    if price is None:
        raise UnknownTickerError(ticker)

    _quote_cache[ticker] = (price, time.time())
    return price


def _fetch_price(ticker: str) -> Decimal | None:
    yf_ticker = yf.Ticker(ticker)
    try:
        last = yf_ticker.fast_info.last_price
        if last:
            return Decimal(str(round(float(last), 4)))
    except Exception:
        logger.debug("fast_info failed for %s, falling back to history", ticker)

    try:
        hist = yf_ticker.history(period="5d")
        if not hist.empty:
            return Decimal(str(round(float(hist["Close"].iloc[-1]), 4)))
    except Exception:
        logger.warning("history lookup failed for %s", ticker, exc_info=True)
    return None


def search(query: str, limit: int = 10) -> list[dict]:
    """Search tickers by name or symbol."""
    try:
        results = yf.Search(query, max_results=limit).quotes
    except Exception:
        logger.warning("ticker search failed for %r", query, exc_info=True)
        return []

    return [
        {
            "ticker": item.get("symbol"),
            "name": item.get("shortname") or item.get("longname") or "",
            "exchange": item.get("exchange") or "",
            "type": item.get("quoteType") or "",
        }
        for item in results
        if item.get("symbol")
    ]


def get_history(ticker: str, period: str = "1mo") -> list[dict]:
    """Daily closes for a ticker over a yfinance period string (1mo, 3mo, 1y...)."""
    hist = yf.Ticker(ticker.upper().strip()).history(period=period)
    if hist.empty:
        raise UnknownTickerError(ticker)
    return [
        {"date": index.date().isoformat(), "close": round(float(row["Close"]), 4)}
        for index, row in hist.iterrows()
    ]
