/** Market data via Yahoo Finance's public chart/search endpoints (the same
 * ones yfinance wraps). In-isolate caches keep request volume low. */

import { r4 } from "./util.js";

const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; FakeStockGame/1.0)" };
const QUOTE_TTL_MS = 5 * 60 * 1000;
const RANGE_TTL_MS = 60 * 60 * 1000;

const quoteCache = new Map(); // ticker -> {price, at}
const rangeCache = new Map(); // key -> {rows, at}

export class UnknownTickerError extends Error {
  constructor(ticker) {
    super(`No price data found for ticker '${ticker}'`);
    this.ticker = ticker;
  }
}

async function fetchChart(ticker, query) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?${query}`;
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) return null;
  const body = await response.json();
  return body?.chart?.result?.[0] ?? null;
}

function chartRows(result) {
  const timestamps = result?.timestamp ?? [];
  const adjusted =
    result?.indicators?.adjclose?.[0]?.adjclose ??
    result?.indicators?.quote?.[0]?.close ??
    [];
  const rows = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (adjusted[i] !== null && adjusted[i] !== undefined) {
      rows.push({
        date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
        close: r4(adjusted[i]),
      });
    }
  }
  return rows;
}

export async function getQuote(ticker) {
  ticker = ticker.toUpperCase().trim();
  const cached = quoteCache.get(ticker);
  if (cached && Date.now() - cached.at < QUOTE_TTL_MS) return cached.price;

  const result = await fetchChart(ticker, "range=5d&interval=1d");
  const rows = result ? chartRows(result) : [];
  const price = result?.meta?.regularMarketPrice ?? rows.at(-1)?.close ?? null;
  if (price === null || price === undefined) throw new UnknownTickerError(ticker);

  const rounded = r4(price);
  quoteCache.set(ticker, { price: rounded, at: Date.now() });
  return rounded;
}

/** Daily (adjusted) closes between two ISO dates inclusive, oldest first. */
export async function getHistoryRange(ticker, startISO, endISO) {
  ticker = ticker.toUpperCase().trim();
  const key = `${ticker}:${startISO}:${endISO}`;
  const cached = rangeCache.get(key);
  if (cached && Date.now() - cached.at < RANGE_TTL_MS) return cached.rows;

  const period1 = Math.floor(Date.parse(`${startISO}T00:00:00Z`) / 1000);
  const period2 = Math.floor(Date.parse(`${endISO}T00:00:00Z`) / 1000) + 86400;
  const result = await fetchChart(
    ticker, `period1=${period1}&period2=${period2}&interval=1d&events=div%2Csplit`
  );
  const rows = result ? chartRows(result) : [];
  rangeCache.set(key, { rows, at: Date.now() });
  return rows;
}

/** Close on a given date, falling back to the most recent close before it
 * (weekends/holidays). Null if the ticker has no data by then. */
export async function getPriceOn(ticker, isoDate) {
  const start = new Date(`${isoDate}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 14);
  const rows = await getHistoryRange(ticker, start.toISOString().slice(0, 10), isoDate);
  const eligible = rows.filter((row) => row.date <= isoDate);
  return eligible.at(-1)?.close ?? null;
}

export async function searchStocks(query, limit = 10) {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=${limit}&newsCount=0`;
  try {
    const response = await fetch(url, { headers: HEADERS });
    if (!response.ok) return [];
    const body = await response.json();
    return (body?.quotes ?? [])
      .filter((item) => item.symbol)
      .map((item) => ({
        ticker: item.symbol,
        name: item.shortname || item.longname || "",
        exchange: item.exchange || "",
        type: item.quoteType || "",
      }));
  } catch {
    return [];
  }
}

export async function getHistory(ticker, period) {
  const result = await fetchChart(ticker.toUpperCase().trim(), `range=${period}&interval=1d`);
  const rows = result ? chartRows(result) : [];
  if (rows.length === 0) throw new UnknownTickerError(ticker);
  return rows;
}
