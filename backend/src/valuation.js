import { getQuote, UnknownTickerError } from "./market.js";
import { r2 } from "./util.js";

/** Live quote if possible, otherwise the most recent stored daily snapshot. */
export async function getPriceWithFallback(env, ticker) {
  try {
    return await getQuote(ticker);
  } catch (error) {
    if (!(error instanceof UnknownTickerError)) console.warn("quote failed", ticker, error);
  }
  const snapshot = await env.DB.prepare(
    "SELECT price FROM price_snapshots WHERE ticker = ? ORDER BY snapshot_date DESC LIMIT 1"
  ).bind(ticker).first();
  return snapshot?.price ?? null;
}

/** Values a set of holding rows (live wallets). Returns {total, breakdown}. */
export async function valueHoldings(env, holdingRows) {
  let total = 0;
  const breakdown = [];
  for (const holding of holdingRows) {
    const price = await getPriceWithFallback(env, holding.ticker);
    const value = price === null ? null : r2(holding.shares * price);
    if (value !== null) total += value;
    breakdown.push({
      ticker: holding.ticker,
      shares: holding.shares,
      avg_cost: holding.avg_cost,
      current_price: price,
      market_value: value,
      cost_basis: r2(holding.shares * holding.avg_cost),
    });
  }
  return { total: r2(total), breakdown };
}

export async function membershipHoldings(env, membershipId) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM holdings WHERE membership_id = ? ORDER BY ticker"
  ).bind(membershipId).all();
  return results;
}
