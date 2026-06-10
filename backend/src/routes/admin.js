import { Hono } from "hono";
import { runDailyUpdate } from "../dailyUpdate.js";

const router = new Hono();

/** Manually trigger the daily price/portfolio snapshot + allowance job. */
router.post("/run-daily-update", async (c) => c.json(await runDailyUpdate(c.env)));

export default router;
