import { Hono } from "hono";
import { createToken, requireUser, serializeUser, verifyGoogleCredential } from "../auth.js";
import { ApiError } from "../util.js";

const router = new Hono();

async function uniqueUsername(env, info) {
  const base =
    (info.email || "player").split("@")[0].toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 40) ||
    "player";
  let username = base;
  let suffix = 1;
  while (await env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(username).first()) {
    suffix++;
    username = `${base}${suffix}`;
  }
  return username;
}

router.post("/google", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body?.credential || String(body.credential).length < 20) {
    throw new ApiError(422, "Missing required field 'credential'");
  }
  const info = await verifyGoogleCredential(c.env, body.credential);

  let user = await c.env.DB.prepare("SELECT * FROM users WHERE google_sub = ?")
    .bind(info.sub)
    .first();
  if (!user) {
    const username = await uniqueUsername(c.env, info);
    user = await c.env.DB.prepare(
      `INSERT INTO users (google_sub, username, display_name, email, picture)
       VALUES (?, ?, ?, ?, ?) RETURNING *`
    )
      .bind(
        info.sub,
        username,
        info.name || (info.email || "Player").split("@")[0],
        info.email ?? null,
        info.picture ?? null
      )
      .first();
  } else {
    user = await c.env.DB.prepare(
      "UPDATE users SET display_name = ?, email = ?, picture = ? WHERE id = ? RETURNING *"
    )
      .bind(
        info.name || user.display_name,
        info.email || user.email,
        info.picture || user.picture,
        user.id
      )
      .first();
  }

  return c.json({ token: await createToken(c.env, user.id), user: serializeUser(user) });
});

router.get("/me", requireUser, (c) => c.json(serializeUser(c.var.user)));

export default router;
