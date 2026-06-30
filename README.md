# tradelunch

Personal portfolio + financial markets dashboard for Taek Lim.

Live: [my.prettylog.com](https://my.prettylog.com)

---

## What's inside

pnpm + Turborepo monorepo, Node 24.

```
apps/
  dashboard_client_web/   Next.js 16 App Router — blog + finance dashboard
  dashboard_server/       Express 5 + pg Pool → Supabase Postgres — blog + dashboard API
  blog_agent/             Python (uv) — markdown blog publisher → Supabase
  stock_collector/        Python (uv) — Yahoo OHLC collector → market data (GitHub Actions cron)
packages/
  @repo/ui                Shared React components
  @repo/axios             Shared axios client
  @repo/markdown-parsing  Markdown → HTML pipeline (GFM, KaTeX, prism)
  @repo/assets            Static assets
  @repo/types             Shared TypeScript types
  @repo/{tailwind,eslint,typescript,jest}-config
```

Per-app READMEs:

- [`apps/dashboard_client_web`](./apps/dashboard_client_web/README.md) — Next.js client + SSR
- [`apps/dashboard_server`](./apps/dashboard_server/README.md) — Express API
- [`apps/blog_agent`](./apps/blog_agent/README.md) — markdown → Supabase publisher (Python)
- [`apps/stock_collector`](./apps/stock_collector/README.md) — market-data collector (Python)

Two product surfaces share the Next.js app:

- **Blog / portfolio** — technical posts, infinite scroll, full Markdown + LaTeX
- **Financial dashboard** — read-only market snapshot (FX, crypto, indices, rates, stocks)

---

## Dashboard data pipeline

The finance dashboard is **read-only over pre-collected data** — nothing hits Yahoo at request
time. A GitHub Actions cron runs the `stock_collector` (Python, yfinance), writes market data to
Supabase Postgres, and the dashboard serves it through the Express API.

```
GitHub Actions cron
  └─ stock_collector (Python / yfinance)
       ├─ market_history     daily OHLC bars (interval '1d')
       ├─ market_snapshots   latest value + 1-day change (per label)
       └─ market_rankings / tracked_symbols   weekly market-cap ranking
  └─ Supabase Postgres
       └─ dashboard_server   GET /v1/api/dashboard/{snapshot,history}
            └─ dashboard_client_web   /dashboard
```

### What is collected & how often

| Workflow | Schedule (UTC) | Collects | Writes |
|---|---|---|---|
| `collector-daily` | Mon–Fri **21:30** (after the US close) | Daily OHLC for the watchlist (≤42 labels + sticky-ranked symbols) via Yahoo | `market_history` (interval `1d`, incremental) + `market_snapshots` (latest close + 1-day change) |
| `collector-weekly` | Sun **06:00** | S&P500-class market-cap ranking (global + per-sector) | `market_rankings` (append) + `tracked_symbols` (sticky top-20 global / top-10 sector) + `symbol_fundamentals` cache |
| `collector-keepalive` | 1st & 15th **12:00** | — | touches the repo so GitHub doesn't disable the crons after 60 days idle |

Watchlist — 42 labels, `apps/stock_collector/configs/watchlist.yaml` (editable; add a symbol to
collect it daily):

- **FX (4):** EUR/USD, USD/KRW, USD/JPY, USD/THB
- **Crypto (3):** BTC/USD, ETH/USD, SOL/USD
- **Rates (4):** US 3M, US 5Y, US 10Y, US 30Y
- **Indices (7):** S&P 500, NASDAQ Composite, NASDAQ 100, NASDAQ 100 Futures, KOSPI, KOSPI 200, KOSDAQ
- **Stocks (24):** QQQ, QQQM, QLD, TQQQ, SPY, SCHD, SGOV, SHY, IEF, TLT, TSLA, GOOG, AAPL, NVDA, SOXL, IBIT, MSTR, COIN, CRCL, SPCX, SMR, SOFI, XLE, DBA

### Granularity — daily only

The collector stores **daily** bars only (`interval = '1d'`); the dashboard derives the rest
client-side:

- **Snapshot change** = latest close − previous close (1-day), from the last 2 daily bars.
- **Chart `D`** = the daily series as-is.
- **Chart `W` / `M`** = daily bars aggregated into weekly / monthly OHLC buckets.
- **Chart intraday (`1m`–`4h`)** = _synthesized_ deterministically — **not** real intraday (no
  sub-day data is collected).

`DASHBOARD_DATA_SOURCE=backend` (frontend env) flips the **snapshot** from mock to live data.
Chart history currently still reads the static mock map (`app/dashboard/page.tsx`) — wiring it to
`GET /history` (interval `1d`) is the remaining step to put real candles on the chart.

---

## Quick start

Requires Node 24 (`nvm use`) and pnpm 9.

```sh
pnpm install
pnpm dev                                # all apps in parallel
pnpm dev:web                            # client app only — http://localhost:3001
pnpm --filter dashboard_server dev      # server app only
```

Other common scripts:

```sh
pnpm build           # production build (turbo run build)
pnpm lint            # eslint across workspaces
pnpm check-types     # tsc --noEmit per workspace
pnpm format          # prettier write
```

---

## Documentation

- [`CLAUDE.md`](./CLAUDE.md) — repo topology, commands, architecture
- [`00.plan.md`](./00.plan.md) — current phase plan (active: Phase 2-simple finance dashboard MVP)
- [`00.tasks.md`](./00.tasks.md) — atomic task list
- [`.claude/CLAUDE.md`](./.claude/CLAUDE.md) — engineering principles (KISS, SRP, layering, ≤300 LOC)
- [`.claude/rules/`](./.claude/rules/) — language and framework conventions

---

## Admin bootstrap

There is **no admin-grant UI** by design — users are lazy-provisioned with `is_admin = false`.
To promote the owner, run a **one-time** SQL statement in the Supabase SQL Editor *after* that
account has signed up and completed onboarding (so the `users` row exists):

```sql
UPDATE users SET is_admin = true WHERE username = '<owner-username>';
```

Match by `username` or `clerk_user_id` — **never `email`** (lazy-provisioned users have a NULL
`email`, so an email match silently updates zero rows). This single-owner bootstrap is intentionally
manual; an env/config allowlist would be over-engineering for one admin.

---

## Tech stack

Next.js 16 · React 19 · TypeScript strict · Tailwind v4 · Radix UI · shadcn/ui · lucide-react · Jotai · TanStack Query v5 · next-intl · Clerk (auth) · Express 5 · pg Pool · Supabase (Postgres + Storage) · Python (uv) · Vercel · GitHub Actions · pnpm 9 · Turborepo · PM2
