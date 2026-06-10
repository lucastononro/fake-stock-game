# 📈 Fake Stock Game

A fantasy stock-trading game to play with friends. Create an account, start a group (or join
one with an invite code), and everyone trades real stocks with fake money. Prices come from
Yahoo Finance, and a daily job snapshots prices and portfolio values so groups can track who's
winning.

## Stack

- **Backend** — FastAPI + SQLAlchemy + APScheduler, Google Sign-In (ID-token verification)
  with app-issued JWTs, market data via
  [yfinance](https://github.com/ranaroussi/yfinance) (no API key needed)
- **Database** — PostgreSQL
- **Frontend** — React (Vite) + React Router
- **Dev environment** — Docker Compose with hot reload on both sides

## Quick start

```bash
cp .env.example .env   # put your Google OAuth client ID in it
docker compose up --build
```

- App: http://localhost:5173
- API docs (Swagger): http://localhost:8001/docs
- Postgres: localhost:5433 (`stockgame` / `stockgame`)

Sign-in uses Google. Create a **Web application OAuth client ID** in Google Cloud Console
(APIs & Services → Credentials) with `http://localhost:5173` as an authorized JavaScript
origin, and set it as `GOOGLE_CLIENT_ID` in `.env`. No client secret is needed — the backend
verifies Google ID tokens and issues its own JWTs.

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
  app/
    main.py          # FastAPI app, CORS, router wiring, lifespan
    config.py        # Settings (env-driven)
    auth.py          # JWT issuing/validation + bcrypt (group passwords)
    database.py      # Engine, session, Base
    models/          # SQLAlchemy models (one file per entity)
    schemas.py       # Pydantic request/response models
    routers/         # HTTP endpoints (auth, groups, memberships, stocks, admin)
    services/        # Business logic: market data, trading, allowance, daily job
frontend/
  src/
    api/client.js    # Fetch wrapper with auth header + endpoints
    context/         # Auth session (token in localStorage)
    pages/           # Auth, Dashboard, Group room, Portfolio
    components/      # Navbar, Modal, InviteCode, StockSearch, TradeForm
docker-compose.yml   # db + backend + frontend, hot reload
```

## Local development without Docker

```bash
# backend (needs a local Postgres matching backend/.env.example)
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload

# frontend
cd frontend && npm install && npm run dev
```

## Roadmap

- [ ] Portfolio value charts (snapshots are already collected)
- [ ] Group settings editing, leaving groups
- [ ] Alembic migrations (currently `create_all` on startup)
- [ ] Set a proper `SECRET_KEY` env var before hosting
