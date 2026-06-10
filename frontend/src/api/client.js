const BASE_URL = import.meta.env.VITE_API_URL || "/api";
const TOKEN_KEY = "fake-stock-game:token";
const USER_KEY = "fake-stock-game:user";

export function storeSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}

async function request(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  if (response.status === 401 && !path.startsWith("/auth/")) {
    clearSession();
    window.location.href = "/login";
    throw new Error("Session expired, please sign in again");
  }
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
  // auth
  register: (payload) => post("/auth/register", payload),
  login: (payload) => post("/auth/login", payload),

  // groups
  myGroups: () => get("/groups/mine"),
  createGroup: (payload) => post("/groups", payload),
  lookupGroup: (inviteCode) => get(`/groups/lookup/${encodeURIComponent(inviteCode)}`),
  joinGroup: (payload) => post("/groups/join", payload),
  getGroup: (groupId) => get(`/groups/${groupId}`),
  getLeaderboard: (groupId) => get(`/groups/${groupId}/leaderboard`),

  // portfolio / trading
  getPortfolio: (membershipId) => get(`/memberships/${membershipId}/portfolio`),
  listTransactions: (membershipId) => get(`/memberships/${membershipId}/transactions`),
  trade: (membershipId, payload) => post(`/memberships/${membershipId}/trades`, payload),

  // stocks
  searchStocks: (q) => get(`/stocks/search?q=${encodeURIComponent(q)}`),
  getQuote: (ticker) => get(`/stocks/${encodeURIComponent(ticker)}/quote`),
};

export function formatMoney(value) {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export function formatSigned(value) {
  const number = Number(value);
  return `${number >= 0 ? "+" : ""}${formatMoney(number)}`;
}
