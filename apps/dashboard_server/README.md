# dashboard_server

Express 5 API — the backend of the [tradelunch](../../README.md) monorepo.
See repo root [`CLAUDE.md`](../../CLAUDE.md) for full architecture and conventions.

## Why

The browser never touches the database or Supabase directly. This server is the **sole writer**:
all blog and dashboard data flows through its HTTP API, behind Clerk auth.

## What

- **Blog** — posts, drafts, feeds, comments, likes, favorites, categories, tags.
- **Dashboard** — read-only market data for the finance dashboard.
- **Funds** — SEC 13F institutional-holdings viewer (public read).
- **Users / admin** — account + admin management; image upload + optimization (`sharp` → Supabase Storage).
- All routes are under **`/v1/api/*`** (e.g. `/v1/api/posts`). Health check: `GET /ping` → `{status:"ok"}`.

## How

```sh
pnpm --filter dashboard_server dev          # dev (tsx watch) → http://localhost:4000
pnpm --filter dashboard_server build        # tsc + tsc-alias
pnpm --filter dashboard_server start        # node dist/src/index.js
pnpm --filter dashboard_server start:pm2    # production via PM2
pnpm --filter dashboard_server test         # jest (also test:unit / test:integration / test:coverage)
pnpm --filter dashboard_server check-types  # tsc --noEmit
```

- Port: `4000` (`PORT`, default).
- Stack: Express 5, raw SQL over **`pg` Pool** (no ORM), **Supabase Postgres** + **Supabase Storage** (REST), Clerk auth, Zod, jest.
- Env (see `.env.example`): `POSTGRES_URL` (pooled runtime), `POSTGRES_URL_NON_POOLING` (migrations),
  `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_STORAGE_BUCKET`, `CLERK_SECRET_KEY`, `ALLOWED_ORIGINS`.
- DB migrations via Supabase CLI: `pnpm --filter dashboard_server db:push` / `db:diff` / `db:status`.
