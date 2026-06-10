"""Portfolio value series built by replaying a transaction ledger against
historical daily closes. Shared by live portfolios and Time Machine
simulations; returns rich points (total / cash / stocks / per-ticker) so the
frontend can filter freely."""

from bisect import bisect_right
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from typing import TypedDict

from app.models import TransactionType
from app.services import market

TWO_PLACES = Decimal("0.01")
MAX_POINTS = 400


class LedgerRecord(TypedDict):
    """A normalized transaction: live wallets use created_at's date,
    simulations use sim_date."""

    date: date
    type: TransactionType
    ticker: str | None
    shares: Decimal | None
    amount: Decimal


def build_series(records: list[LedgerRecord], start: date, end: date) -> list[dict]:
    records = sorted(records, key=lambda r: r["date"])
    tickers = {r["ticker"] for r in records if r["ticker"]}

    closes: dict[str, tuple[list[date], list[Decimal]]] = {}
    for ticker in tickers:
        rows = market.get_history_range(ticker, start - timedelta(days=14), end)
        closes[ticker] = ([r[0] for r in rows], [r[1] for r in rows])

    def close_at(ticker: str, day: date) -> Decimal | None:
        dates, prices = closes[ticker]
        index = bisect_right(dates, day) - 1
        return prices[index] if index >= 0 else None

    total_days = (end - start).days + 1
    step = max(1, total_days // MAX_POINTS)
    sample_days = [start + timedelta(days=offset) for offset in range(0, total_days, step)]
    if sample_days[-1] != end:
        sample_days.append(end)

    series = []
    cash = Decimal("0")
    shares: dict[str, Decimal] = defaultdict(Decimal)
    record_index = 0
    for day in sample_days:
        while record_index < len(records) and records[record_index]["date"] <= day:
            record = records[record_index]
            cash += record["amount"]
            if record["type"] == TransactionType.BUY:
                shares[record["ticker"]] += record["shares"]
            elif record["type"] == TransactionType.SELL:
                shares[record["ticker"]] -= record["shares"]
            record_index += 1

        by_ticker: dict[str, Decimal] = {}
        for ticker, count in shares.items():
            if count > 0:
                price = close_at(ticker, day)
                if price is not None:
                    by_ticker[ticker] = (count * price).quantize(TWO_PLACES)
        stocks_value = sum(by_ticker.values(), Decimal("0"))
        series.append(
            {
                "date": day,
                "cash": cash.quantize(TWO_PLACES),
                "stocks_value": stocks_value.quantize(TWO_PLACES),
                "total_value": (cash + stocks_value).quantize(TWO_PLACES),
                "by_ticker": by_ticker,
            }
        )
    return series
