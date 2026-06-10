const BASE_URL = import.meta.env.VITE_API_URL || "/api";

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      // non-JSON error body, keep statusText
    }
    throw new Error(detail);
  }
  return response.json();
}

const get = (path) => request(path);
const post = (path, body) => request(path, { method: "POST", body: JSON.stringify(body) });

export const api = {
  // users
  listUsers: () => get("/users"),
  createUser: (payload) => post("/users", payload),
  listUserMemberships: (userId) => get(`/users/${userId}/memberships`),

  // groups
  listGroups: () => get("/groups"),
  createGroup: (payload) => post("/groups", payload),
  getGroup: (groupId) => get(`/groups/${groupId}`),
  joinGroup: (groupId, payload) => post(`/groups/${groupId}/join`, payload),
  getLeaderboard: (groupId) => get(`/groups/${groupId}/leaderboard`),

  // portfolio / trading
  getPortfolio: (membershipId) => get(`/memberships/${membershipId}/portfolio`),
  listTransactions: (membershipId) => get(`/memberships/${membershipId}/transactions`),
  getPortfolioHistory: (membershipId) => get(`/memberships/${membershipId}/history`),
  trade: (membershipId, payload) => post(`/memberships/${membershipId}/trades`, payload),

  // stocks
  searchStocks: (q) => get(`/stocks/search?q=${encodeURIComponent(q)}`),
  getQuote: (ticker) => get(`/stocks/${encodeURIComponent(ticker)}/quote`),
  getStockHistory: (ticker, period = "1mo") =>
    get(`/stocks/${encodeURIComponent(ticker)}/history?period=${period}`),
};

export function formatMoney(value) {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}
