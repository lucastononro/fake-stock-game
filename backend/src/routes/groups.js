import { Hono } from "hono";
import { hashPassword, requireUser, serializeUser, verifyPassword } from "../auth.js";
import { membershipHoldings, valueHoldings } from "../valuation.js";
import {
  ApiError,
  generateInviteCode,
  isoTimestamp,
  positiveNumber,
  r2,
  requireFields,
} from "../util.js";

const router = new Hono();
router.use("*", requireUser);

export const serializeGroup = (group, memberCount) => ({
  id: group.id,
  name: group.name,
  owner_id: group.owner_id,
  initial_cash: group.initial_cash,
  monthly_allowance: group.monthly_allowance,
  invite_code: group.invite_code,
  created_at: isoTimestamp(group.created_at),
  member_count: memberCount,
  has_password: group.join_password_hash !== null,
});

export const serializeMembership = (m) => ({
  id: m.id,
  user_id: m.user_id,
  group_id: m.group_id,
  cash_balance: m.cash_balance,
  joined_at: isoTimestamp(m.joined_at),
});

async function getGroup(env, groupId) {
  const group = await env.DB.prepare("SELECT * FROM groups WHERE id = ?").bind(groupId).first();
  if (!group) throw new ApiError(404, "Group not found");
  return group;
}

async function groupMembers(env, groupId) {
  const { results } = await env.DB.prepare(
    `SELECT m.*, u.id AS u_id, u.username, u.display_name, u.email, u.picture,
            u.created_at AS u_created_at
     FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.group_id = ?`
  ).bind(groupId).all();
  return results;
}

async function memberCount(env, groupId) {
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM memberships WHERE group_id = ?"
  ).bind(groupId).first();
  return row.n;
}

async function createMembership(env, userId, group) {
  const membership = await env.DB.prepare(
    `INSERT INTO memberships (user_id, group_id, cash_balance, last_allowance_at)
     VALUES (?, ?, ?, ?) RETURNING *`
  ).bind(userId, group.id, group.initial_cash, Date.now()).first();
  await env.DB.prepare(
    "INSERT INTO transactions (membership_id, type, amount) VALUES (?, 'INITIAL_DEPOSIT', ?)"
  ).bind(membership.id, group.initial_cash).run();
  return membership;
}

async function leaderboardEntries(env, group) {
  const members = await groupMembers(env, group.id);
  const entries = [];
  for (const member of members) {
    const holdings = await membershipHoldings(env, member.id);
    const { total: holdingsValue } = await valueHoldings(env, holdings);
    const totalValue = r2(member.cash_balance + holdingsValue);
    const allowances = await env.DB.prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM transactions
       WHERE membership_id = ? AND type = 'ALLOWANCE'`
    ).bind(member.id).first();
    const deposited = r2(group.initial_cash + allowances.total);
    const profit = r2(totalValue - deposited);
    entries.push({
      membership_id: member.id,
      user: serializeUser({
        id: member.u_id,
        username: member.username,
        display_name: member.display_name,
        email: member.email,
        picture: member.picture,
        created_at: member.u_created_at,
      }),
      cash_balance: member.cash_balance,
      holdings_value: holdingsValue,
      total_value: totalValue,
      profit,
      profit_pct: deposited > 0 ? r2((profit / deposited) * 100) : 0,
    });
  }
  entries.sort((a, b) => b.total_value - a.total_value);
  return entries;
}

async function requireMembership(env, group, user) {
  const membership = await env.DB.prepare(
    "SELECT * FROM memberships WHERE group_id = ? AND user_id = ?"
  ).bind(group.id, user.id).first();
  if (!membership) throw new ApiError(403, "You are not a member of this group");
  return membership;
}

router.post("/", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  requireFields(body, ["name", "initial_cash"]);
  if (String(body.name).trim().length < 2) throw new ApiError(422, "Group name is too short");
  const initialCash = positiveNumber(body.initial_cash, "initial_cash");
  const monthlyAllowance = Number(body.monthly_allowance ?? 0);
  if (!Number.isFinite(monthlyAllowance) || monthlyAllowance < 0) {
    throw new ApiError(422, "monthly_allowance must be zero or positive");
  }
  if (body.password && String(body.password).length < 4) {
    throw new ApiError(422, "Group password must be at least 4 characters");
  }

  const group = await c.env.DB.prepare(
    `INSERT INTO groups (name, owner_id, initial_cash, monthly_allowance, invite_code, join_password_hash)
     VALUES (?, ?, ?, ?, ?, ?) RETURNING *`
  )
    .bind(
      String(body.name).trim(),
      c.var.user.id,
      r2(initialCash),
      r2(monthlyAllowance),
      generateInviteCode(),
      body.password ? await hashPassword(body.password) : null
    )
    .first();
  await createMembership(c.env, c.var.user.id, group); // owner joins their own group
  return c.json(serializeGroup(group, 1), 201);
});

router.get("/mine", async (c) => {
  const { results: memberships } = await c.env.DB.prepare(
    "SELECT * FROM memberships WHERE user_id = ?"
  ).bind(c.var.user.id).all();

  const summaries = [];
  for (const membership of memberships) {
    const group = await getGroup(c.env, membership.group_id);
    const entries = await leaderboardEntries(c.env, group);
    const index = entries.findIndex((e) => e.membership_id === membership.id);
    const mine = entries[index];
    summaries.push({
      group: serializeGroup(group, entries.length),
      membership_id: membership.id,
      cash_balance: mine.cash_balance,
      total_value: mine.total_value,
      profit: mine.profit,
      rank: index + 1,
      is_owner: group.owner_id === c.var.user.id,
    });
  }
  summaries.sort((a, b) => (a.group.created_at < b.group.created_at ? -1 : 1));
  return c.json(summaries);
});

router.get("/lookup/:code", async (c) => {
  const code = c.req.param("code").toUpperCase().trim();
  const group = await c.env.DB.prepare("SELECT * FROM groups WHERE invite_code = ?")
    .bind(code)
    .first();
  if (!group) throw new ApiError(404, "No group found with that invite code");
  const already = await c.env.DB.prepare(
    "SELECT id FROM memberships WHERE group_id = ? AND user_id = ?"
  ).bind(group.id, c.var.user.id).first();
  return c.json({
    name: group.name,
    member_count: await memberCount(c.env, group.id),
    initial_cash: group.initial_cash,
    monthly_allowance: group.monthly_allowance,
    requires_password: group.join_password_hash !== null,
    already_member: Boolean(already),
  });
});

router.post("/join", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  requireFields(body, ["invite_code"]);
  const group = await c.env.DB.prepare("SELECT * FROM groups WHERE invite_code = ?")
    .bind(String(body.invite_code).toUpperCase().trim())
    .first();
  if (!group) throw new ApiError(404, "No group found with that invite code");
  if (group.join_password_hash !== null) {
    const ok = body.password && (await verifyPassword(body.password, group.join_password_hash));
    if (!ok) throw new ApiError(403, "Wrong group password");
  }
  const existing = await c.env.DB.prepare(
    "SELECT id FROM memberships WHERE group_id = ? AND user_id = ?"
  ).bind(group.id, c.var.user.id).first();
  if (existing) throw new ApiError(409, "You are already a member of this group");

  const membership = await createMembership(c.env, c.var.user.id, group);
  return c.json(serializeMembership(membership), 201);
});

router.get("/:id", async (c) => {
  const group = await getGroup(c.env, Number(c.req.param("id")));
  await requireMembership(c.env, group, c.var.user);
  return c.json(serializeGroup(group, await memberCount(c.env, group.id)));
});

router.get("/:id/leaderboard", async (c) => {
  const group = await getGroup(c.env, Number(c.req.param("id")));
  await requireMembership(c.env, group, c.var.user);
  return c.json(await leaderboardEntries(c.env, group));
});

export default router;
