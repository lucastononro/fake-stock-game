/** The daily job: credit due monthly allowances, snapshot prices for every
 * held ticker, and record each wallet's total value for the day. Runs from
 * the cron trigger and the manual /admin/run-daily-update endpoint. */

import { getPriceWithFallback, membershipHoldings, valueHoldings } from "./valuation.js";
import { addMonths, r2, todayISO } from "./util.js";

export async function creditDueAllowances(env) {
  const { results: memberships } = await env.DB.prepare(
    `SELECT m.*, g.monthly_allowance FROM memberships m
     JOIN groups g ON g.id = m.group_id WHERE g.monthly_allowance > 0`
  ).all();

  const now = new Date();
  let credits = 0;
  for (const membership of memberships) {
    let last = new Date(membership.last_allowance_at);
    let cash = membership.cash_balance;
    const statements = [];
    while (addMonths(last, 1) <= now) {
      last = addMonths(last, 1);
      cash = r2(cash + membership.monthly_allowance);
      statements.push(
        env.DB.prepare(
          "INSERT INTO transactions (membership_id, type, amount, created_at) VALUES (?, 'ALLOWANCE', ?, ?)"
        ).bind(membership.id, membership.monthly_allowance, last.getTime())
      );
      credits++;
    }
    if (statements.length > 0) {
      statements.push(
        env.DB.prepare(
          "UPDATE memberships SET cash_balance = ?, last_allowance_at = ? WHERE id = ?"
        ).bind(cash, last.getTime(), membership.id)
      );
      await env.DB.batch(statements);
    }
  }
  return credits;
}

export async function runDailyUpdate(env) {
  const today = todayISO();
  const allowances = await creditDueAllowances(env);

  const { results: tickers } = await env.DB.prepare(
    "SELECT DISTINCT ticker FROM holdings"
  ).all();
  let pricesUpdated = 0;
  for (const { ticker } of tickers) {
    const price = await getPriceWithFallback(env, ticker);
    if (price === null) continue;
    await env.DB.prepare(
      `INSERT INTO price_snapshots (ticker, price, snapshot_date) VALUES (?, ?, ?)
       ON CONFLICT (ticker, snapshot_date) DO UPDATE SET price = excluded.price`
    ).bind(ticker, price, today).run();
    pricesUpdated++;
  }

  const { results: memberships } = await env.DB.prepare("SELECT * FROM memberships").all();
  for (const membership of memberships) {
    const holdings = await membershipHoldings(env, membership.id);
    const { total } = await valueHoldings(env, holdings);
    const totalValue = r2(membership.cash_balance + total);
    await env.DB.prepare(
      `INSERT INTO portfolio_snapshots (membership_id, total_value, cash_balance, snapshot_date)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (membership_id, snapshot_date) DO UPDATE
         SET total_value = excluded.total_value, cash_balance = excluded.cash_balance`
    ).bind(membership.id, totalValue, membership.cash_balance, today).run();
  }

  return {
    date: today,
    allowances_credited: allowances,
    tickers_updated: pricesUpdated,
    portfolios_updated: memberships.length,
  };
}
