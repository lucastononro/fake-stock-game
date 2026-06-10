import { Hono } from "hono";
import { getHistory, getQuote, searchStocks, UnknownTickerError } from "../market.js";
import { ApiError } from "../util.js";

const VALID_PERIODS = new Set(["5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "max"]);

const router = new Hono();

router.get("/search", async (c) => {
  const query = (c.req.query("q") || "").trim();
  if (!query || query.length > 50) throw new ApiError(422, "q must be 1-50 characters");
  return c.json(await searchStocks(query));
});

router.get("/:ticker/quote", async (c) => {
  const ticker = c.req.param("ticker").toUpperCase().trim();
  try {
    return c.json({ ticker, price: await getQuote(ticker) });
  } catch (error) {
    if (error instanceof UnknownTickerError) throw new ApiError(404, error.message);
    throw error;
  }
});

router.get("/:ticker/history", async (c) => {
  const period = c.req.query("period") || "1mo";
  if (!VALID_PERIODS.has(period)) {
    throw new ApiError(400, `period must be one of ${[...VALID_PERIODS].sort().join(", ")}`);
  }
  try {
    return c.json(await getHistory(c.req.param("ticker"), period));
  } catch (error) {
    if (error instanceof UnknownTickerError) throw new ApiError(404, error.message);
    throw error;
  }
});

export default router;
