import { Hono } from "hono";
import { requireUser } from "../auth.js";
import { buildSeries } from "../charts.js";
import { getPriceOn } from "../market.js";
import {
  ApiError,
  addDaysISO,
  addMonthsISO,
  isoTimestamp,
  positiveNumber,
  r2,
  r4,
  requireFields,
  todayISO,
} from "../util.js";

const router = new Hono();
router.use("*", requireUser);

const serializeSimulation = (s) => ({
  id: s.id,
  name: s.name,
  start_date: s.start_date,
  current_date: s.current_day,
  initial_cash: s.initial_cash,
  cash_balance: s.cash_balance,
  created_at: isoTimestamp(s.created_at),
});

const serializeTransaction = (t) => ({
  id: t.id,
  type: t.type,
  ticker: t.ticker,
  shares: t.shares,
  price: t.price,
  amount: t.amount,
  sim_date: t.sim_date,
});

async function ownSimulation(env, simulationId, user) {
  const simulation = await env.DB.prepare("SELECT * FROM simulations WHERE id = ?")
    .bind(simulationId)
    .first();
  if (!simulation || simulation.user_id !== user.id) {
    throw new ApiError(404, "Simulation not found");
  }
  return simulation;
}

async function simHoldings(env, simulationId) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM simulation_holdings WHERE simulation_id = ? ORDER BY ticker"
  ).bind(simulationId).all();
  return results;
}

async function simPrice(simulation, ticker) {
  const price = await getPriceOn(ticker, simulation.current_day);
  if (price === null) {
    throw new ApiError(
      400,
      `No market data for ${ticker} on ${simulation.current_day} — it may not have been listed yet`
    );
  }
  return price;
}

async function valueSimHoldings(simulation, holdings) {
  let total = 0;
  const breakdown = [];
  for (const holding of holdings) {
    const price = await getPriceOn(holding.ticker, simulation.current_day);
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

async function summarize(env, simulation) {
  const holdings = await simHoldings(env, simulation.id);
  const { total } = await valueSimHoldings(simulation, holdings);
  const totalValue = r2(simulation.cash_balance + total);
  return {
    simulation: serializeSimulation(simulation),
    total_value: totalValue,
    profit: r2(totalValue - simulation.initial_cash),
  };
}

router.post("/", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  requireFields(body, ["name", "start_date", "initial_cash"]);
  const startDate = String(body.start_date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new ApiError(422, "Invalid start_date");
  if (startDate >= todayISO()) throw new ApiError(422, "start_date must be in the past");
  if (startDate < "1980-01-01") throw new ApiError(422, "start_date must be 1980 or later");
  const initialCash = r2(positiveNumber(body.initial_cash, "initial_cash"));

  const simulation = await c.env.DB.prepare(
    `INSERT INTO simulations (user_id, name, start_date, current_day, initial_cash, cash_balance)
     VALUES (?, ?, ?, ?, ?, ?) RETURNING *`
  ).bind(c.var.user.id, String(body.name).trim(), startDate, startDate, initialCash, initialCash)
    .first();
  await c.env.DB.prepare(
    `INSERT INTO simulation_transactions (simulation_id, type, amount, sim_date)
     VALUES (?, 'INITIAL_DEPOSIT', ?, ?)`
  ).bind(simulation.id, initialCash, startDate).run();
  return c.json(serializeSimulation(simulation), 201);
});

router.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM simulations WHERE user_id = ? ORDER BY created_at"
  ).bind(c.var.user.id).all();
  const summaries = [];
  for (const simulation of results) summaries.push(await summarize(c.env, simulation));
  return c.json(summaries);
});

router.get("/:id", async (c) => {
  const simulation = await ownSimulation(c.env, Number(c.req.param("id")), c.var.user);
  const holdings = await simHoldings(c.env, simulation.id);
  const { total, breakdown } = await valueSimHoldings(simulation, holdings);
  const totalValue = r2(simulation.cash_balance + total);
  const profit = r2(totalValue - simulation.initial_cash);
  return c.json({
    simulation: serializeSimulation(simulation),
    holdings: breakdown,
    holdings_value: total,
    total_value: totalValue,
    profit,
    profit_pct: simulation.initial_cash > 0 ? r2((profit / simulation.initial_cash) * 100) : 0,
  });
});

router.delete("/:id", async (c) => {
  const simulation = await ownSimulation(c.env, Number(c.req.param("id")), c.var.user);
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM simulation_transactions WHERE simulation_id = ?").bind(simulation.id),
    c.env.DB.prepare("DELETE FROM simulation_holdings WHERE simulation_id = ?").bind(simulation.id),
    c.env.DB.prepare("DELETE FROM simulations WHERE id = ?").bind(simulation.id),
  ]);
  return c.body(null, 204);
});

router.post("/:id/trades", async (c) => {
  const simulation = await ownSimulation(c.env, Number(c.req.param("id")), c.var.user);
  const body = await c.req.json().catch(() => ({}));
  requireFields(body, ["side", "ticker", "shares"]);
  if (body.side !== "buy" && body.side !== "sell") {
    throw new ApiError(400, `Unknown trade side '${body.side}'`);
  }
  const shares = positiveNumber(body.shares, "Shares");
  const ticker = String(body.ticker).toUpperCase().trim();
  const price = await simPrice(simulation, ticker);
  const total = r2(price * shares);
  const holding = await c.env.DB.prepare(
    "SELECT * FROM simulation_holdings WHERE simulation_id = ? AND ticker = ?"
  ).bind(simulation.id, ticker).first();

  const statements = [];
  if (body.side === "buy") {
    if (simulation.cash_balance < total) {
      throw new ApiError(400, `Insufficient cash: need ${total}, have ${simulation.cash_balance}`);
    }
    if (!holding) {
      statements.push(
        c.env.DB.prepare(
          "INSERT INTO simulation_holdings (simulation_id, ticker, shares, avg_cost) VALUES (?, ?, ?, ?)"
        ).bind(simulation.id, ticker, shares, price)
      );
    } else {
      const newShares = holding.shares + shares;
      const newAvgCost = r4((holding.shares * holding.avg_cost + total) / newShares);
      statements.push(
        c.env.DB.prepare("UPDATE simulation_holdings SET shares = ?, avg_cost = ? WHERE id = ?")
          .bind(newShares, newAvgCost, holding.id)
      );
    }
    statements.push(
      c.env.DB.prepare("UPDATE simulations SET cash_balance = ? WHERE id = ?")
        .bind(r2(simulation.cash_balance - total), simulation.id)
    );
  } else {
    if (!holding || holding.shares < shares) {
      const held = holding?.shares ?? 0;
      throw new ApiError(400, `Insufficient shares of ${ticker}: have ${held}, selling ${shares}`);
    }
    const remaining = holding.shares - shares;
    statements.push(
      remaining < 1e-9
        ? c.env.DB.prepare("DELETE FROM simulation_holdings WHERE id = ?").bind(holding.id)
        : c.env.DB.prepare("UPDATE simulation_holdings SET shares = ? WHERE id = ?")
            .bind(remaining, holding.id)
    );
    statements.push(
      c.env.DB.prepare("UPDATE simulations SET cash_balance = ? WHERE id = ?")
        .bind(r2(simulation.cash_balance + total), simulation.id)
    );
  }
  statements.push(
    c.env.DB.prepare(
      `INSERT INTO simulation_transactions (simulation_id, type, ticker, shares, price, amount, sim_date)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`
    ).bind(
      simulation.id,
      body.side === "buy" ? "BUY" : "SELL",
      ticker,
      shares,
      price,
      body.side === "buy" ? -total : total,
      simulation.current_day
    )
  );

  const results = await c.env.DB.batch(statements);
  return c.json(serializeTransaction(results.at(-1).results[0]), 201);
});

router.post("/:id/advance", async (c) => {
  const simulation = await ownSimulation(c.env, Number(c.req.param("id")), c.var.user);
  const body = await c.req.json().catch(() => ({}));
  requireFields(body, ["amount", "unit"]);
  const amount = Math.floor(positiveNumber(body.amount, "amount"));
  if (amount > 520) throw new ApiError(422, "amount is too large");

  let newDate;
  if (body.unit === "days") newDate = addDaysISO(simulation.current_day, amount);
  else if (body.unit === "weeks") newDate = addDaysISO(simulation.current_day, amount * 7);
  else if (body.unit === "months") newDate = addMonthsISO(simulation.current_day, amount);
  else throw new ApiError(400, `Unknown time unit '${body.unit}'`);

  const today = todayISO();
  if (newDate > today) newDate = today;
  if (newDate === simulation.current_day) {
    throw new ApiError(400, "The simulation has caught up with today — it can't go further");
  }
  const updated = await c.env.DB.prepare(
    "UPDATE simulations SET current_day = ? WHERE id = ? RETURNING *"
  ).bind(newDate, simulation.id).first();
  return c.json(serializeSimulation(updated));
});

router.get("/:id/quote", async (c) => {
  const simulation = await ownSimulation(c.env, Number(c.req.param("id")), c.var.user);
  const ticker = (c.req.query("ticker") || "").toUpperCase().trim();
  if (!ticker) throw new ApiError(422, "Missing required query param 'ticker'");
  let price;
  try {
    price = await simPrice(simulation, ticker);
  } catch (error) {
    if (error instanceof ApiError) throw new ApiError(404, error.message);
    throw error;
  }
  return c.json({ ticker, price, date: simulation.current_day });
});

router.get("/:id/transactions", async (c) => {
  const simulation = await ownSimulation(c.env, Number(c.req.param("id")), c.var.user);
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM simulation_transactions WHERE simulation_id = ? ORDER BY sim_date DESC, id DESC"
  ).bind(simulation.id).all();
  return c.json(results.map(serializeTransaction));
});

router.get("/:id/chart", async (c) => {
  const simulation = await ownSimulation(c.env, Number(c.req.param("id")), c.var.user);
  const { results: transactions } = await c.env.DB.prepare(
    "SELECT * FROM simulation_transactions WHERE simulation_id = ? ORDER BY sim_date, id"
  ).bind(simulation.id).all();
  const records = transactions.map((t) => ({
    date: t.sim_date,
    type: t.type,
    ticker: t.ticker,
    shares: t.shares,
    amount: t.amount,
  }));
  return c.json(await buildSeries(records, simulation.start_date, simulation.current_day));
});

export default router;
