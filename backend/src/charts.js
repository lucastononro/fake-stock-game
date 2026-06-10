/** Portfolio value series built by replaying a transaction ledger against
 * historical daily closes. Shared by live wallets and simulations. */

import { getHistoryRange } from "./market.js";
import { addDaysISO, diffDays, lastIndexLE, r2 } from "./util.js";

const MAX_POINTS = 400;

/** records: [{date: 'YYYY-MM-DD', type, ticker, shares, amount}] */
export async function buildSeries(records, startISO, endISO) {
  records = [...records].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const tickers = [...new Set(records.filter((r) => r.ticker).map((r) => r.ticker))];

  const closes = {};
  for (const ticker of tickers) {
    const rows = await getHistoryRange(ticker, addDaysISO(startISO, -14), endISO);
    closes[ticker] = { dates: rows.map((r) => r.date), prices: rows.map((r) => r.close) };
  }

  const closeAt = (ticker, day) => {
    const { dates, prices } = closes[ticker];
    const index = lastIndexLE(dates, day);
    return index >= 0 ? prices[index] : null;
  };

  const totalDays = diffDays(startISO, endISO) + 1;
  const step = Math.max(1, Math.floor(totalDays / MAX_POINTS));
  const sampleDays = [];
  for (let offset = 0; offset < totalDays; offset += step) {
    sampleDays.push(addDaysISO(startISO, offset));
  }
  if (sampleDays.at(-1) !== endISO) sampleDays.push(endISO);

  const series = [];
  let cash = 0;
  const shares = {};
  let recordIndex = 0;
  for (const day of sampleDays) {
    while (recordIndex < records.length && records[recordIndex].date <= day) {
      const record = records[recordIndex];
      cash += record.amount;
      if (record.type === "BUY") shares[record.ticker] = (shares[record.ticker] ?? 0) + record.shares;
      else if (record.type === "SELL") shares[record.ticker] = (shares[record.ticker] ?? 0) - record.shares;
      recordIndex++;
    }
    const byTicker = {};
    for (const [ticker, count] of Object.entries(shares)) {
      if (count > 1e-9) {
        const price = closeAt(ticker, day);
        if (price !== null) byTicker[ticker] = r2(count * price);
      }
    }
    const stocksValue = r2(Object.values(byTicker).reduce((sum, v) => sum + v, 0));
    series.push({
      date: day,
      cash: r2(cash),
      stocks_value: stocksValue,
      total_value: r2(cash + stocksValue),
      by_ticker: byTicker,
    });
  }
  return series;
}
