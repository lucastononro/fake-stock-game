# 📈 Fake Stock Game

A fantasy stock-trading game to play with friends. Create an account, start a group (or join
one with an invite code), and everyone trades real stocks with fake money. Prices come from
Yahoo Finance, and a daily job snapshots prices and portfolio values so groups can track who's
winning.

## Stack

Built for Cloudflare:

- **Backend** — Cloudflare Worker: [Hono](https://hono.dev) routing,
  [jose](https://github.com/panva/jose) for Google Sign-In verification + app JWTs,
  market data straight from Yahoo Finance's public endpoints (no API key), and a
  Cron Trigger for the daily job
- **Database** — Cloudflare D1 (SQLite), schema in `backend/migrations/`
- **Frontend** — React (Vite) + React Router
- **Dev environment** — Docker Compose (`wrangler dev` with a local D1 + Vite, hot reload)

## Quick start

```bash
cp .env.example .env   # put your Google OAuth client ID in it
docker compose up --build
```

- App: http://localhost:5173
- API: http://localhost:8001 (local Worker with a local D1 database)

Sign-in uses Google — see the credentials walkthrough below.

## Getting Google OAuth credentials

One-time setup, ~5 minutes, free (no billing required):

1. **Open [Google Cloud Console](https://console.cloud.google.com)** and sign in with any
   Google account.
2. **Create a project**: project dropdown (top bar) → *New project* → name it (e.g.
   `fake-stock-game`) → *Create*, then make sure it's selected.
3. **Configure the OAuth consent screen**: *APIs & Services → OAuth consent screen* →
   user type **External**. Fill only the required fields (app name + your email), skip
   logos and scopes, and save through the steps. The app stays in **Testing** mode — add
   yourself and any friends who'll play under **Test users** (only listed emails can sign
   in until you publish the app).
4. **Create the client ID**: *APIs & Services → Credentials → + Create credentials →
   OAuth client ID* → application type **Web application**. Under **Authorized JavaScript
   origins** add exactly:
   ```
   http://localhost:5173
   ```
   Leave *Authorized redirect URIs* empty (the popup flow doesn't use one). *Create*.
5. **Copy the Client ID** (ends in `.apps.googleusercontent.com`) into `.env`:
   ```
   GOOGLE_CLIENT_ID=123456789012-abc123.apps.googleusercontent.com
   ```
   Ignore the client secret — this flow never uses it. The backend only verifies Google's
   signed ID tokens (against this client ID) and then issues its own JWTs.
6. `docker compose up -d backend frontend` to pick up the change.

Gotchas: the origin must match exactly (`localhost`, not `127.0.0.1`); a freshly created
client ID can take a minute or two to start working; when you host the app later, add the
production HTTPS domain as a second authorized origin on the same client ID.

## The experience

1. **Sign in with Google** — one click, no passwords.
2. **Create a group** — set everyone's starting cash, a monthly allowance, and optionally a
   group password. You get a short invite code like `KX7M2APQ`.
3. **Invite friends** — they paste the code in "Join with code" on their dashboard (and the
   password, if you set one), see a preview of the group, and join.
4. **Trade** — search any stock, buy/sell at the live market price, fractional shares allowed.
5. **Compete** — the group room shows a live leaderboard; your dashboard shows your standing
   in every group you're in.

Monthly allowances are credited automatically (one month after joining, then monthly), and a
daily job at 21:00 UTC snapshots prices and portfolio values. Trigger it manually with
`POST /admin/run-daily-update`.

## How it's modeled

| Concept | Meaning |
|---|---|
| **User** | An account (Google Sign-In, app JWT sessions) |
| **Group** | A game room: `initial_cash`, `monthly_allowance`, invite code, optional password |
| **Membership** | A user's wallet inside one group — cash + holdings live here |
| **Holding** | Shares of one ticker in a wallet, with average cost |
| **Transaction** | Ledger entry: buys, sells, starting cash, allowance credits |
| **Snapshots** | Daily price per ticker + daily total value per wallet |

## API overview

| Method & path | Description |
|---|---|
| `POST /auth/google` | Verify a Google ID token → app JWT (creates the user on first sign-in) |
| `GET /auth/me` | Current user |
| `POST /groups` | Create a group (creator auto-joins) |
| `GET /groups/mine` | Dashboard: my groups with my value, profit and rank |
| `GET /groups/lookup/{invite_code}` | Preview a group before joining |
| `POST /groups/join` | Join by invite code (+ password if required) |
| `GET /groups/{id}` / `/leaderboard` | Group room data (members only) |
| `GET /memberships/{id}/portfolio` | Cash, holdings and live valuation |
| `POST /memberships/{id}/trades` | Buy or sell (`{side, ticker, shares}`, own wallet only) |
| `GET /memberships/{id}/transactions` | Wallet ledger |
| `GET /memberships/{id}/history` | Daily portfolio value snapshots |
| `GET /stocks/search?q=` | Ticker search |
| `GET /stocks/{ticker}/quote` / `/history` | Live quote / price history |
| `POST /admin/run-daily-update` | Manually run the daily job |

## Project layout

```
backend/
  wrangler.toml      # Worker config: D1 binding, cron trigger, vars
  migrations/        # D1 SQL migrations
  src/
    index.js         # Hono app wiring + scheduled (cron) handler
    auth.js          # Google ID-token verification, app JWTs, group passwords
    market.js        # Yahoo Finance quotes/search/history (cached)
    valuation.js     # Wallet valuation with snapshot fallback
    charts.js        # Ledger-replay portfolio value series
    dailyUpdate.js   # Allowances + price/portfolio snapshots
    routes/          # auth, groups, memberships, simulations, stocks, admin
frontend/
  src/
    api/client.js    # Fetch wrapper with auth header + endpoints
    context/         # Auth session (token in localStorage)
    pages/           # Auth, Dashboard, Group room, Portfolio, Simulation
    components/      # Charts, donut, trade form, modals, ...
docker-compose.yml   # wrangler dev + vite, hot reload
```

## Local development without Docker

```bash
# backend (local Worker + local D1)
cd backend && npm install
npm run migrate:local && npm run dev   # http://localhost:8787

# frontend (point the proxy at wrangler's port)
cd frontend && npm install
BACKEND_URL=http://localhost:8787 npm run dev
```

## Deploying to Cloudflare

One-time setup (needs a free Cloudflare account and `npx wrangler login`):

```bash
cd backend

# 1. Create the production D1 database and paste the printed id
#    into wrangler.toml under [[d1_databases]] -> database_id
npx wrangler d1 create fake-stock-game

# 2. Apply the schema
npm run migrate:prod

# 3. Secrets & vars
npx wrangler secret put SECRET_KEY        # any long random string
# set GOOGLE_CLIENT_ID under [vars] in wrangler.toml (it's public, fine to commit)

# 4. Ship it
npm run deploy
```

The Worker URL it prints (e.g. `https://fake-stock-game-api.<you>.workers.dev`) serves the
API; the cron trigger runs the daily update at 21:00 UTC automatically.

For the frontend, deploy `frontend/` to Cloudflare Pages (build command `npm run build`,
output `dist`) with env vars `VITE_API_URL=https://<your-worker-url>` and
`VITE_GOOGLE_CLIENT_ID=<your client id>`. Then add the Pages domain
(`https://<project>.pages.dev`) as an authorized JavaScript origin on the Google OAuth
client, alongside `http://localhost:5173`.

## Roadmap

- [ ] Group settings editing, leaving groups
- [ ] Publish the Google OAuth consent screen (lift the test-users-only limit)
