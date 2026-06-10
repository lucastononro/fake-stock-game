-- Migration number: 0001    init
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  google_sub TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  email TEXT,
  picture TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  owner_id INTEGER NOT NULL REFERENCES users(id),
  initial_cash REAL NOT NULL,
  monthly_allowance REAL NOT NULL DEFAULT 0,
  invite_code TEXT NOT NULL UNIQUE,
  join_password_hash TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE memberships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  group_id INTEGER NOT NULL REFERENCES groups(id),
  cash_balance REAL NOT NULL,
  last_allowance_at INTEGER NOT NULL,
  joined_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  UNIQUE (user_id, group_id)
);
CREATE INDEX idx_memberships_user ON memberships(user_id);
CREATE INDEX idx_memberships_group ON memberships(group_id);

CREATE TABLE holdings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  membership_id INTEGER NOT NULL REFERENCES memberships(id),
  ticker TEXT NOT NULL,
  shares REAL NOT NULL,
  avg_cost REAL NOT NULL,
  UNIQUE (membership_id, ticker)
);

CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  membership_id INTEGER NOT NULL REFERENCES memberships(id),
  type TEXT NOT NULL,
  ticker TEXT,
  shares REAL,
  price REAL,
  amount REAL NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX idx_transactions_membership ON transactions(membership_id);

CREATE TABLE price_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticker TEXT NOT NULL,
  price REAL NOT NULL,
  snapshot_date TEXT NOT NULL,
  UNIQUE (ticker, snapshot_date)
);

CREATE TABLE portfolio_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  membership_id INTEGER NOT NULL REFERENCES memberships(id),
  total_value REAL NOT NULL,
  cash_balance REAL NOT NULL,
  snapshot_date TEXT NOT NULL,
  UNIQUE (membership_id, snapshot_date)
);

CREATE TABLE simulations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  current_day TEXT NOT NULL,
  initial_cash REAL NOT NULL,
  cash_balance REAL NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX idx_simulations_user ON simulations(user_id);

CREATE TABLE simulation_holdings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  simulation_id INTEGER NOT NULL REFERENCES simulations(id),
  ticker TEXT NOT NULL,
  shares REAL NOT NULL,
  avg_cost REAL NOT NULL,
  UNIQUE (simulation_id, ticker)
);

CREATE TABLE simulation_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  simulation_id INTEGER NOT NULL REFERENCES simulations(id),
  type TEXT NOT NULL,
  ticker TEXT,
  shares REAL,
  price REAL,
  amount REAL NOT NULL,
  sim_date TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX idx_sim_transactions_sim ON simulation_transactions(simulation_id);
