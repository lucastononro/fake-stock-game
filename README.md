# 📈 Fake Stock Game

A fantasy stock-trading game to play with friends. Create a group, set the starting cash and
a monthly allowance, and everyone trades real stocks with fake money. Prices come from Yahoo
Finance, and a daily job snapshots prices and portfolio values so groups can track who's winning.

> ⚠️ No authentication yet — players are picked on the honor system. Auth comes later.

## Stack

- **Backend** — FastAPI + SQLAlchemy + APScheduler, market data via [yfinance](https://github.com/ranaroussi/yfinance) (no API key needed)
- **Database** — PostgreSQL
- **Frontend** — React (Vite) + React Router
- **Dev environment** — Docker Compose with hot reload on both sides

## Quick start

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- API docs (Swagger): http://localhost:8000/docs

Then: create a player → create a group (initial cash + monthly allowance) → friends join the
group → everyone buys/sells stocks → check the leaderboard.

## How the game works

| Concept | Meaning |
|---|---|
| **User** | A player (no password for now) |
| **Group** | A game: defines `initial_cash` and `monthly_allowance` |
| **Membership** | A user's wallet inside one group — cash + holdings live here |
| **Holding** | Shares of one ticker in a wallet, with average cost |
| **Transaction** | Ledger entry: buys, sells, initial deposit, allowance credits |
| **Snapshots** | Daily price per ticker + daily total value per wallet |

- Joining a group credits the wallet with the group's initial cash.
- Every month after joining, the wallet receives the group's allowance (the daily job
  catches up missed months automatically).
- Trades execute at the live market price; fractional shares are allowed.
- A scheduler runs daily at 21:00 UTC (configurable) to snapshot prices and portfolio
  values and credit due allowances. It can also be triggered manually:
  `POST /admin/run-daily-update`.

## API overview

| Method & path | Description |
|---|---|
| `POST /users` | Create a player |
| `GET /users` / `GET /users/{id}/memberships` | List players / a player's wallets |
| `POST /groups` | Create a group (owner auto-joins) |
| `POST /groups/{id}/join` | Join a group (creates a wallet with initial cash) |
| `GET /groups/{id}/leaderboard` | Ranked total values with P&L |
| `GET /memberships/{id}/portfolio` | Cash, holdings and live valuation |
| `POST /memberships/{id}/trades` | Buy or sell (`{side, ticker, shares}`) |
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
    database.py      # Engine, session, Base
    models/          # SQLAlchemy models (one file per entity)
    schemas.py       # Pydantic request/response models
    routers/         # HTTP endpoints (users, groups, memberships, stocks, admin)
    services/        # Business logic: market data, trading, allowance, daily job
frontend/
  src/
    api/client.js    # Fetch wrapper + endpoints
    context/         # Current-player selection (localStorage)
    pages/           # Players, Groups, Group detail, Portfolio
    components/      # Navbar, StockSearch, TradeForm
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

- [ ] Authentication / sessions
- [ ] Portfolio value charts (snapshots are already collected)
- [ ] Group settings editing, leaving groups
- [ ] Alembic migrations (currently `create_all` on startup)
