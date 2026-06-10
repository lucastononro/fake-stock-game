import { Hono } from "hono";
import { requireUser, serializeUser } from "../auth.js";
import { buildSeries } from "../charts.js";
import { getQuote, UnknownTickerError } from "../market.js";
import { serializeGroup, serializeMembership } from "./groups.js";
import { membershipHoldings, valueHoldings } from "../valuation.js";
import {
  ApiError,
  dateOfMs,
  isoTimestamp,
  positiveNumber,
  r2,
  r4,
  requireFields,
  todayISO,
} from "../util.js";

const router = new Hono();
router.use("*", requireUser);

const serializeTransaction = (t) => ({
  id: t.id,
  type: t.type,
  ticker: t.ticker,
  shares: t.shares,
  price: t.price,
  amount: t.amount,
  created_at: isoTimestamp(t.created_at),
});

async function getMembership(env, membershipId) {
  const membership = await env.DB.prepare("SELECT * FROM memberships WHERE id = ?")
    .bind(membershipId)
    .first();
  if (!membership) throw new ApiError(404, "Portfolio not found");
  return membership;
}

/** Members of the same group can view each other's portfolios. */
async function membershipForViewer(env, membershipId, viewer) {
  const membership = await getMembership(env, membershipId);
  const sameGroup = await env.DB.prepare(
    "SELECT id FROM memberships WHERE group_id = ? AND user_id = ?"
  ).bind(membership.group_id, viewer.id).first();
  if (!sameGroup) throw new ApiError(403, "You are not a member of this group");
  return membership;
}

async function ownMembership(env, membershipId, viewer) {
  const membership = await getMembership(env, membershipId);
  if (membership.user_id !== viewer.id) {
    throw new ApiError(403, "You can only trade with your own wallet");
  }
  return membership;
}

router.get("/:id/portfolio", async (c) => {
  const membership = await membershipForViewer(c.env, Number(c.req.param("id")), c.var.user);
  const group = await c.env.DB.prepare("SELECT * FROM groups WHERE id = ?")
    .bind(membership.group_id)
    .first();
  const owner = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?")
    .bind(membership.user_id)
    .first();
  const members = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM memberships WHERE group_id = ?"
  ).bind(group.id).first();
  const holdings = await membershipHoldings(c.env, membership.id);
  const { total: holdingsValue, breakdown } = await valueHoldings(c.env, holdings);

  return c.json({
    membership: serializeMembership(membership),
    group: serializeGroup(group, members.n),
    user: serializeUser(owner),
    holdings: breakdown,
    holdings_value: holdingsValue,
    total_value: r2(membership.cash_balance + holdingsValue),
    is_mine: membership.user_id === c.var.user.id,
  });
});

router.post("/:id/trades", async (c) => {
  const membership = await ownMembership(c.env, Number(c.req.param("id")), c.var.user);
  const body = await c.req.json().catch(() => ({}));
  requireFields(body, ["side", "ticker", "shares"]);
  if (body.side !== "buy" && body.side !== "sell") {
    throw new ApiError(422, `Unknown trade side '${body.side}'`);
  }
  const shares = positiveNumber(body.shares, "Shares");
  const ticker = String(body.ticker).toUpperCase().trim();

  let price;
  try {
    price = await getQuote(ticker);
  } catch (error) {
    if (error instanceof UnknownTickerError) throw new ApiError(404, error.message);
    throw error;
  }
  const total = r2(price * shares);
  const holding = await c.env.DB.prepare(
    "SELECT * FROM holdings WHERE membership_id = ? AND ticker = ?"
  ).bind(membership.id, ticker).first();

  const statements = [];
  if (body.side === "buy") {
    if (membership.cash_balance < total) {
      throw new ApiError(400, `Insufficient cash: need ${total}, have ${membership.cash_balance}`);
    }
    if (!holding) {
      statements.push(
        c.env.DB.prepare(
          "INSERT INTO holdings (membership_id, ticker, shares, avg_cost) VALUES (?, ?, ?, ?)"
        ).bind(membership.id, ticker, shares, price)
      );
    } else {
      const newShares = holding.shares + shares;
      const newAvgCost = r4((holding.shares * holding.avg_cost + total) / newShares);
      statements.push(
        c.env.DB.prepare("UPDATE holdings SET shares = ?, avg_cost = ? WHERE id = ?")
          .bind(newShares, newAvgCost, holding.id)
      );
    }
    statements.push(
      c.env.DB.prepare("UPDATE memberships SET cash_balance = ? WHERE id = ?")
        .bind(r2(membership.cash_balance - total), membership.id)
    );
  } else {
    if (!holding || holding.shares < shares) {
      const held = holding?.shares ?? 0;
      throw new ApiError(400, `Insufficient shares of ${ticker}: have ${held}, selling ${shares}`);
    }
    const remaining = holding.shares - shares;
    statements.push(
      remaining < 1e-9
        ? c.env.DB.prepare("DELETE FROM holdings WHERE id = ?").bind(holding.id)
        : c.env.DB.prepare("UPDATE holdings SET shares = ? WHERE id = ?").bind(remaining, holding.id)
    );
    statements.push(
      c.env.DB.prepare("UPDATE memberships SET cash_balance = ? WHERE id = ?")
        .bind(r2(membership.cash_balance + total), membership.id)
    );
  }
  statements.push(
    c.env.DB.prepare(
      `INSERT INTO transactions (membership_id, type, ticker, shares, price, amount)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING *`
    ).bind(
      membership.id,
      body.side === "buy" ? "BUY" : "SELL",
      ticker,
      shares,
      price,
      body.side === "buy" ? -total : total
    )
  );

  const results = await c.env.DB.batch(statements);
  const transaction = results.at(-1).results[0];
  return c.json(serializeTransaction(transaction), 201);
});

router.get("/:id/transactions", async (c) => {
  const membership = await membershipForViewer(c.env, Number(c.req.param("id")), c.var.user);
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM transactions WHERE membership_id = ? ORDER BY created_at DESC, id DESC"
  ).bind(membership.id).all();
  return c.json(results.map(serializeTransaction));
});

router.get("/:id/chart", async (c) => {
  const membership = await membershipForViewer(c.env, Number(c.req.param("id")), c.var.user);
  const { results: transactions } = await c.env.DB.prepare(
    "SELECT * FROM transactions WHERE membership_id = ? ORDER BY created_at, id"
  ).bind(membership.id).all();

  const records = transactions.map((t) => ({
    date: dateOfMs(t.created_at),
    type: t.type,
    ticker: t.ticker,
    shares: t.shares,
    amount: t.amount,
  }));
  const series = await buildSeries(records, dateOfMs(membership.joined_at), todayISO());

  // Align the final point with live valuation so it matches the stat tiles.
  const holdings = await membershipHoldings(c.env, membership.id);
  const { total: holdingsValue, breakdown } = await valueHoldings(c.env, holdings);
  const last = series.at(-1);
  last.cash = membership.cash_balance;
  last.stocks_value = holdingsValue;
  last.total_value = r2(membership.cash_balance + holdingsValue);
  last.by_ticker = Object.fromEntries(
    breakdown.filter((h) => h.market_value !== null).map((h) => [h.ticker, h.market_value])
  );
  return c.json(series);
});

router.get("/:id/history", async (c) => {
  const membership = await membershipForViewer(c.env, Number(c.req.param("id")), c.var.user);
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM portfolio_snapshots WHERE membership_id = ? ORDER BY snapshot_date"
  ).bind(membership.id).all();
  return c.json(
    results.map((row) => ({
      snapshot_date: row.snapshot_date,
      total_value: row.total_value,
      cash_balance: row.cash_balance,
    }))
  );
});

export default router;
