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

Two product surfaces share the Next.js app:

- **Blog / portfolio** — technical posts, infinite scroll, full Markdown + LaTeX
- **Financial dashboard** — read-only market snapshot (FX, crypto, indices, rates, stocks)

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
