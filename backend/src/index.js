import { Hono } from "hono";
import { cors } from "hono/cors";
import { runDailyUpdate } from "./dailyUpdate.js";
import adminRoutes from "./routes/admin.js";
import authRoutes from "./routes/auth.js";
import groupRoutes from "./routes/groups.js";
import membershipRoutes from "./routes/memberships.js";
import simulationRoutes from "./routes/simulations.js";
import stockRoutes from "./routes/stocks.js";
import { ApiError } from "./util.js";

const app = new Hono();

app.use("*", cors());

app.get("/health", (c) => c.json({ status: "ok" }));
app.route("/auth", authRoutes);
app.route("/groups", groupRoutes);
app.route("/memberships", membershipRoutes);
app.route("/simulations", simulationRoutes);
app.route("/stocks", stockRoutes);
app.route("/admin", adminRoutes);

app.notFound((c) => c.json({ detail: "Not Found" }, 404));
app.onError((error, c) => {
  if (error instanceof ApiError) return c.json({ detail: error.message }, error.status);
  console.error(error);
  return c.json({ detail: "Internal Server Error" }, 500);
});

export default {
  fetch: app.fetch,
  scheduled: (event, env, ctx) => {
    ctx.waitUntil(
      runDailyUpdate(env).then(
        (summary) => console.log("daily update", JSON.stringify(summary)),
        (error) => console.error("daily update failed", error)
      )
    );
  },
};
